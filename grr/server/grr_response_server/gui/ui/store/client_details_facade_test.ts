import {discardPeriodicTasks, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {ConfigService} from '@app/components/config/config';
import {ApiClient} from '@app/lib/api/api_interfaces';
import {HttpApiService} from '@app/lib/api/http_api_service';
import {Client} from '@app/lib/models/client';
import {newClient} from '@app/lib/models/model_test_util';
import {initTestEnvironment} from '@app/testing';
import {Subject} from 'rxjs';

import {ClientVersion, getClientVersions} from './client_details_diff';
import {ClientDetailsFacade} from './client_details_facade';


initTestEnvironment();

describe('ClientDetailsFacade', () => {
  let httpApiService: Partial<HttpApiService>;
  let clientDetailsFacade: ClientDetailsFacade;
  let configService: ConfigService;
  let apiFetchClient$: Subject<ApiClient>;
  let apiFetchClientVersions$: Subject<ReadonlyArray<ApiClient>>;

  beforeEach(() => {
    apiFetchClient$ = new Subject();
    apiFetchClientVersions$ = new Subject();
    httpApiService = {
      fetchClient:
          jasmine.createSpy('fetchClient').and.returnValue(apiFetchClient$),
      fetchClientVersions: jasmine.createSpy('fetchClientVersions')
                               .and.returnValue(apiFetchClientVersions$)
    };

    TestBed
        .configureTestingModule({
          imports: [],
          providers: [
            ClientDetailsFacade,
            // Apparently, useValue creates a copy of the object. Using
            // useFactory, to make sure the instance is shared.
            {provide: HttpApiService, useFactory: () => httpApiService},
          ],
        })
        .compileComponents();

    clientDetailsFacade = TestBed.inject(ClientDetailsFacade);
    configService = TestBed.inject(ConfigService);

    clientDetailsFacade.selectClient('C.1234');
    apiFetchClient$.next({
      clientId: 'C.1234',
    });
  });

  it('fetches client versions from API when "selectClient" is called', () => {
    expect(httpApiService.fetchClientVersions).toHaveBeenCalledTimes(1);

    clientDetailsFacade.selectClient('C.4321');
    expect(httpApiService.fetchClientVersions).toHaveBeenCalledWith('C.4321');
  });

  it('getClientVersions() correctly translates snapshots into client changes',
     () => {
       const snapshots = [
         // Client created
         newClient({
           clientId: 'C.1234',
           age: new Date(2020, 1, 1),
         }),
         // 3 User entries added
         newClient({
           clientId: 'C.1234',
           users: [
             {username: 'newUser1'},
             {username: 'newUser2'},
             {username: 'newUser3'},
           ],
           age: new Date(2020, 1, 2),
         }),
         // Oner User full name updated, One User home directory updated
         newClient({
           clientId: 'C.1234',
           users: [
             {username: 'newUser1', fullName: 'new User1 fullname'},
             {username: 'newUser2', homedir: 'homedir2'},
             {username: 'newUser3', fullName: 'new User3 fullname'},
           ],
           age: new Date(2020, 1, 3),
         }),
         // One User added, One User home directory updated
         newClient({
           clientId: 'C.1234',
           users: [
             {username: 'newUser1', fullName: 'new User1 fullname'},
             {username: 'newUser2', homedir: 'homedir2-change'},
             {username: 'newUser3', fullName: 'new User3 fullname'},
             {username: 'newUser4', fullName: 'new User4 fullname'},
           ],
           age: new Date(2020, 1, 4),
         }),
         // 4 User entries deleted
         newClient({
           clientId: 'C.1234',
           users: [],
           age: new Date(2020, 1, 5),
         }),
         // No changes besides non-relevant properties (e.g. age)
         newClient({
           clientId: 'C.1234',
           users: [],
           age: new Date(2020, 1, 6),
         }),
         // One Network interface added
         newClient({
           clientId: 'C.1234',
           users: [],
           networkInterfaces: [
             {
               interfaceName: 'lo',
               macAddress: '',
               addresses: [
                 {
                   addressType: 'IPv4',
                   ipAddress: '1.2.3.4',
                 },
               ],
             },
           ],
           age: new Date(2020, 1, 7),
         }),
         // One IP address added, One IP address updated
         newClient({
           clientId: 'C.1234',
           users: [],
           networkInterfaces: [
             {
               interfaceName: 'lo',
               macAddress: '',
               addresses: [
                 {
                   addressType: 'IPv4',
                   ipAddress: '1.2.3.40',
                 },
                 {
                   addressType: 'IPv4',
                   ipAddress: '127.0.0.1',
                 },
               ],
             },
           ],
           age: new Date(2020, 1, 7),
         }),
         // More than 3 changes => X new changes
         newClient({
           clientId: 'C.1234',
           users: [
             {username: 'foo'},
           ],
           memorySize: BigInt(123),
           agentInfo: {
             clientName: 'GRR',
           },
           osInfo: {
             system: 'linux',
           },
           age: new Date(2020, 1, 8),
         }),
       ];

       const expectedClientChanges = [
         {
           client: snapshots[0],
           changes: ['Client created'],
         },
         {
           client: snapshots[1],
           changes: ['3 User entries added'],
         },
         {
           client: snapshots[2],
           changes: [
             '2 User full name entries added', 'One User home directory added'
           ],
         },
         {
           client: snapshots[3],
           changes: ['One User home directory updated', 'One User added'],
         },
         {
           client: snapshots[4],
           changes: ['4 User entries deleted'],
         },
         // Next snapshot is identical to the one before, so it is skipped
         {
           client: snapshots[6],
           changes: ['One Network interface added'],
         },
         {
           client: snapshots[7],
           changes: ['One Network address added', 'One IP address updated'],
         },
         {
           client: snapshots[8],
           changes: ['5 new changes'],
         },
       ].reverse();

       const clientChanges = getClientVersions(snapshots.reverse());

       expect(clientChanges.map(
                  change => {change.client, [...change.changes].sort()}))
           .toEqual(expectedClientChanges.map(expectedChange => {
             expectedChange.client,
             expectedChange.changes.sort()
           }));
     });

  it('getClientVersions() reduces sequences of identical snapshots to the oldest snapshot',
     () => {
       const snapshots = [
         newClient({
           clientId: 'C.1234',
           fleetspeakEnabled: true,
           age: new Date(2020, 2, 2),
         }),
         newClient({
           clientId: 'C.1234',
           fleetspeakEnabled: true,
           age: new Date(2020, 1, 1),
         })
       ];

       const expectedClientChanges = [
         {
           client: snapshots[1],
           changes: ['Client created'],
         },
       ];

       const clientChanges = getClientVersions(snapshots);
       expect(clientChanges).toEqual(expectedClientChanges);
     });
});
