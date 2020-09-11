import {Injectable} from '@angular/core';
import {ConfigService} from '@app/components/config/config';
import {HttpApiService} from '@app/lib/api/http_api_service';
import {translateClient} from '@app/lib/api_translation/client';
import {Client} from '@app/lib/models/client';
import {ComponentStore} from '@ngrx/component-store';
import {combineLatest, Observable, of, timer} from 'rxjs';
import {filter, map, mergeMap, switchMapTo, tap} from 'rxjs/operators';

import {ClientVersion, getClientEntriesChanged, getClientVersions} from './client_details_diff';

interface ClientDetailsState {
  readonly client?: Client;
  readonly clientId?: string;
  readonly clientSnapshots?: Client[];
}
/**
 * ComponentStore implementation used by the ClientDetailsFacade. Shouldn't be
 * used directly. Declared as an exported global symbol to make dependency
 * injection possible.
 */
@Injectable({
  providedIn: 'root',
})
export class ClientDetailsStore extends ComponentStore<ClientDetailsState> {
  constructor(private readonly httpApiService: HttpApiService) {
    super({});

    this.select(state => state.clientId).subscribe(clientId => {
      this.fetchSelectedClientSnapshots();
    });
  }

  /** Reducer updating the clientId in the store's state. */
  readonly updateClientId = this.updater<string>((state, clientId) => {
    return {
      ...state,
      clientId,
    };
  });

  /** Reducer updating the selected client snapshots. */
  private readonly updateSelectedClientSnapshots =
      this.updater<Client[]>((state, clientVersions) => {
        return {
          ...state,
          clientSnapshots: clientVersions,
        };
      });

  /** An effect fetching the versions of the selected client */
  private readonly fetchSelectedClientSnapshots = this.effect<void>(
      obs$ => obs$.pipe(
          switchMapTo(this.select(state => state.clientId)),
          filter((clientId): clientId is string => clientId !== undefined),
          mergeMap(
              clientId => this.httpApiService.fetchClientVersions(clientId)),
          map(apiClientVersions => apiClientVersions.map(translateClient)),
          tap(clientSnapshots =>
                  this.updateSelectedClientSnapshots(clientSnapshots)),
          ));

  /** An observable emitting the snapshots of the selected client. */
  private readonly selectedClientSnapshots$: Observable<ReadonlyArray<Client>> =
      of(undefined).pipe(
          switchMapTo(this.select(state => state.clientSnapshots)),
          filter(
              (clientVersions): clientVersions is Client[] =>
                  clientVersions !== undefined),
          // Reverse snapshots to provide reverse chronological order
          map(snapshots => snapshots.slice().reverse()),
      );

  /** An observable emitting the client versions of the selected client */
  readonly selectedClientVersions$: Observable<ReadonlyArray<ClientVersion>> =
      this.selectedClientSnapshots$.pipe(
          map((snapshots) => getClientVersions(snapshots)),
      );

  /**
   * An observable emitting the client changed entries of the selected client
   */
  readonly selectedClientEntriesChanged$:
      Observable<Map<string, ReadonlyArray<Client>>> =
          this.selectedClientSnapshots$.pipe(
              map((snapshots) => getClientEntriesChanged(snapshots)),
          );
}

/** Facade for client details related API calls. */
@Injectable({
  providedIn: 'root',
})
export class ClientDetailsFacade {
  constructor(private readonly store: ClientDetailsStore) {}

  /** An observable emitting the client versions of the selected client. */
  readonly selectedClientVersions$: Observable<ReadonlyArray<ClientVersion>> =
      this.store.selectedClientVersions$;

  /**
   * An observable emitting the client changed entries of the selected client
   */
  readonly selectedClientEntriesChanged$:
      Observable<Map<string, ReadonlyArray<Client>>> =
          this.store.selectedClientEntriesChanged$;

  /** Selects a client with a given id. */
  selectClient(clientId: string): void {
    this.store.updateClientId(clientId);
  }
}
