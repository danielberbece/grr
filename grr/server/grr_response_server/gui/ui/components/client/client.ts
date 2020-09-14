import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
<<<<<<< HEAD
import {Title} from '@angular/platform-browser';
=======
import {MatDialog} from '@angular/material/dialog';
>>>>>>> ca5746b6 (Add label to client (#806))
import {ActivatedRoute} from '@angular/router';
import {ClientLabel} from '@app/lib/models/client';
import {Subject} from 'rxjs';
import {filter, map, takeUntil} from 'rxjs/operators';

import {ClientLabel} from '../../lib/models/client';
import {isNonNull} from '../../lib/preconditions';
import {ClientPageFacade} from '../../store/client_page_facade';
import {ClientAddLabelDialog} from '../client_add_label_dialog/client_add_label_dialog';

/**
 * Component displaying the details and actions for a single Client.
 */
@Component({
  templateUrl: './client.ng.html',
  styleUrls: ['./client.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Client implements OnInit, OnDestroy {
  private readonly id$ = this.route.paramMap.pipe(
      map(params => params.get('id')),
      filter(isNonNull),
  );

  readonly client$ = this.clientPageFacade.selectedClient$;

  private readonly unsubscribe$ = new Subject<void>();

  constructor(
      private readonly route: ActivatedRoute,
      private readonly clientPageFacade: ClientPageFacade,
<<<<<<< HEAD
      private readonly title: Title,
=======
      private readonly dialog: MatDialog,
>>>>>>> ca5746b6 (Add label to client (#806))
  ) {}

  trackLabel(index: number, label: ClientLabel) {
    return label.name;
  }

  ngOnInit() {
    this.id$.pipe(takeUntil(this.unsubscribe$)).subscribe(id => {
      this.clientPageFacade.selectClient(id);
    });

    this.client$
        .pipe(
            takeUntil(this.unsubscribe$),
            )
        .subscribe(client => {
          const fqdn = client.knowledgeBase.fqdn;
          const info = fqdn ? `${fqdn} (${client.clientId})` : client.clientId;
          this.title.setTitle(`GRR | ${info}`);
        });
  }

  openAddLabelDialog(clientLabels: ReadonlyArray<ClientLabel>) {
    const addLabelDialog = this.dialog.open(ClientAddLabelDialog, {
      data: clientLabels,
    });

    addLabelDialog.afterClosed().subscribe(newLabel => {
      if (newLabel !== undefined && newLabel !== null && newLabel !== '') {
        this.addLabel(newLabel);
      }
    });
  }

  addLabel(label: string) {
    this.clientPageFacade.addClientLabel(label);
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
