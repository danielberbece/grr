import {Component, Inject} from '@angular/core';
import {AbstractControl, FormControl, ValidatorFn} from '@angular/forms';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {ClientLabel} from '@app/lib/models/client';
import {ConfigFacade} from '@app/store/config_facade';
import {Observable} from 'rxjs';
import {filter, map, withLatestFrom} from 'rxjs/operators';

@Component({
  selector: 'client-add-label-dialog',
  templateUrl: './client_add_label_dialog.ng.html',
  styleUrls: ['./client_add_label_dialog.scss'],
})
export class ClientAddLabelDialog {
  constructor(
      private readonly dialogRef: MatDialogRef<ClientAddLabelDialog>,
      @Inject(MAT_DIALOG_DATA) private readonly clientLabels:
          ReadonlyArray<ClientLabel>,
      private readonly configFacade: ConfigFacade) {}

  readonly labelInputControl = new FormControl('', this.labelValidator());
  private readonly allClientsLabels$ = this.configFacade.clientsLabels$;

  /**
   * An internal observable, which emits the following combined:
   *    * a string containing the trimmed input
   *    * a string[] containing all labels used in GRR
   */
  private readonly inputAndAllLabels$ =
      this.labelInputControl.valueChanges.pipe(
          filter((input): input is string|String => input !== undefined),
          map(input => input.trim()),
          withLatestFrom(this.allClientsLabels$),
      );

  /**
   * An observable emitting true when the input label is not exactly matching
   *  any of the existing labels in GRR, and false otherwise.
   */
  readonly isNewLabel$: Observable<boolean> = this.inputAndAllLabels$.pipe(
      map(([input, allLabels]) => {
        if (input === '') return false;
        return !allLabels.includes(input);
      }),
  );

  /**
   * An observable emitting an array of possible labels, for autocompletion.
   *  The array doesn't contain labels already assigned to the client.
   */
  readonly suggestedLabels$: Observable<string[]> =
      this.inputAndAllLabels$.pipe(
          map(([input, allLabels]) => {
            if (input === '') return [];
            return allLabels.filter(label => label.includes(input));
          }),
          map(filteredLabels =>
                  filteredLabels.filter(label => !this.clientHasLabel(label))),
      );

  private clientHasLabel(label: string): boolean {
    const trimmedLabel = label.trim();
    return this.clientLabels.map(clientLabel => clientLabel.name)
        .includes(trimmedLabel);
  }

  private labelValidator(): ValidatorFn {
    return (control: AbstractControl): {[key: string]: any}|null => {
      if (control.value === undefined) {
        return null;
      }
      const inputLabel = control.value.trim();

      if (this.clientHasLabel(inputLabel)) {
        return {'alreadyPresentLabel': {value: inputLabel}};
      }

      return null;
    };
  };

  onCancelClick(): void {
    this.dialogRef.close(undefined);
  }

  onAddClick(): void {
    if (this.labelInputControl.valid) {
      this.dialogRef.close(this.labelInputControl.value.trim());
    }
  }
}
