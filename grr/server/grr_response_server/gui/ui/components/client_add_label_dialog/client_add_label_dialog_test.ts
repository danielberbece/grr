import {async, TestBed, ComponentFixture, inject} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {initTestEnvironment} from '@app/testing';
import {By} from '@angular/platform-browser';
import {ClientAddLabelDialogModule} from './module';
import {ClientAddLabelDialog} from './client_add_label_dialog';
import {ReactiveFormsModule} from '@angular/forms';
import {MatDialogModule, MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {ClientLabel} from '@app/lib/models/client';
import {ConfigFacade} from '@app/store/config_facade';
import {mockConfigFacade, ConfigFacadeMock} from '@app/store/config_facade_test_util';
import {OverlayContainer} from '@angular/cdk/overlay';

initTestEnvironment();

describe('Client Add Label Dialog', () => {
  let fixture: ComponentFixture<ClientAddLabelDialog>;
  let component: ClientAddLabelDialog;
  const clientLabels: ReadonlyArray<ClientLabel> = [
    {owner: '', name: 'label1'},
    {owner: '', name: 'testlabel'}
  ];

  let configFacadeMock: ConfigFacadeMock;
  let dialogCloseSpy: jasmine.Spy;
  let overlayContainer: OverlayContainer;
  let overlayContainerElement: HTMLElement;

  beforeEach(async(() => {
    configFacadeMock = mockConfigFacade();

    TestBed
      .configureTestingModule({
        declarations: [ClientAddLabelDialog],
        imports: [
          ClientAddLabelDialogModule,
          NoopAnimationsModule,  // This makes test faster and more stable.
          ReactiveFormsModule,
          MatDialogModule,
        ],
        providers: [
          {provide: MatDialogRef, useValue: {close(value: string | undefined) {} }},
          {provide: MAT_DIALOG_DATA, useValue: clientLabels},
          {provide: ConfigFacade, useValue: configFacadeMock}
        ],
      })
      .compileComponents();

    inject([OverlayContainer], (oc: OverlayContainer) => {
      overlayContainer = oc;
      overlayContainerElement = oc.getContainerElement();
    })();
  }));

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ClientAddLabelDialog);
    component = fixture.componentInstance;
    dialogCloseSpy = spyOn(component.dialogRef, 'close');
    configFacadeMock.clientsLabelsSubject.next([
      {owner: '', name: 'label1'},
      {owner: '', name: 'unusedlabel'},
      {owner: '', name: 'testlabel'},
    ])
    fixture.detectChanges();
  });

  it('is created successfully', () => {
    expect(component).toBeTruthy();
  });

  it('closes and returns undefined when "Cancel" button is clicked', () => {
    const cancelButton = fixture.debugElement.query(By.css('#cancel'));
    (cancelButton.nativeElement as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(dialogCloseSpy).toHaveBeenCalledWith(undefined);
  });

  it('closes and returns a string with the added label when "Add" button is clicked', () => {
    component.labelInputControl.setValue('newlabel');
    const addButton = fixture.debugElement.query(By.css('#add'));
    (addButton.nativeElement as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(dialogCloseSpy).toHaveBeenCalledWith('newlabel');
  });

  it('closes and returns a string with the added label when on Enter event', () => {
    component.labelInputControl.setValue('newlabel');
    const inputForm = fixture.debugElement.query(By.css('input'));
    (inputForm.nativeElement as HTMLInputElement)
      .dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter'}));
    fixture.detectChanges();
    expect(dialogCloseSpy).toHaveBeenCalledWith('newlabel');
  });

  it('doesn\'t allow adding the same label again', () => {
    component.labelInputControl.setValue('label1');
    const addButton = fixture.debugElement.query(By.css('#add'));
    (addButton.nativeElement as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(dialogCloseSpy).not.toHaveBeenCalled();

    const inputForm = fixture.debugElement.query(By.css('input'));
    (inputForm.nativeElement as HTMLInputElement)
      .dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter'}));
    fixture.detectChanges();
    expect(dialogCloseSpy).not.toHaveBeenCalled();
  });

  it('emmits unused, possible labels in suggestedLabels$ for the given input', (done) => {
    let i = 0;
    component.suggestedLabels$.subscribe(labels => {
      switch (i) {
        case 0:
          expect(labels).toEqual(['unusedlabel']);
          break;
        default:
          expect(labels).toEqual([]);
          done();
      }
      i++;
    });
    component.labelInputControl.setValue('label');
    fixture.detectChanges();
    component.labelInputControl.setValue('label2');
    fixture.detectChanges();
  });

  it('clears options when input is cleared', (done) => {
    let i = 0;
    component.suggestedLabels$.subscribe(labels => {
      switch (i) {
        case 0:
          expect(labels).toEqual(['unusedlabel']);
          break;
        default:
          expect(labels).toEqual([]);
          done();
      }
      i++;
    });
    component.labelInputControl.setValue('label');
    fixture.detectChanges();
    component.labelInputControl.setValue('');
    fixture.detectChanges();
  });

  it('suggests making a new label if the inserted label doesn\'t exist', () => {
    const inputElement =
      fixture.debugElement.query(By.css('input')).nativeElement;
    inputElement.dispatchEvent(new Event('focusin'));
    inputElement.value = 'new different label';
    inputElement.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const options = overlayContainerElement.querySelectorAll('mat-option');
    expect(options.length).toBe(1);
    expect(options.item(0).textContent).toEqual('Add new label "new different label"');
  });

  it('shows label already present option if the client has the inserted an existing label', () => {
    const inputElement =
      fixture.debugElement.query(By.css('input')).nativeElement;
    inputElement.dispatchEvent(new Event('focusin'));
    inputElement.value = 'testlabel';
    inputElement.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const options = overlayContainerElement.querySelectorAll('mat-option');
    expect(options.length).toBe(1);
    expect(options.item(0).textContent).toEqual('Label "testlabel" already present!');
  });

  it('correctly checks if the inserted label is new', (done) => {
    let i = 0;
    component.isNewLabel$.subscribe(isNew => {
      switch (i) {
        case 0:
          expect(isNew).toEqual(true);
          break;
        case 1:
          expect(isNew).toEqual(false);
          break;
        default:
          expect(isNew).toEqual(true);
          done();
      }
      i++;
    });
    component.labelInputControl.setValue('label');
    fixture.detectChanges();
    component.labelInputControl.setValue('label1');
    fixture.detectChanges();
    component.labelInputControl.setValue('label19');
    fixture.detectChanges();
  });

  it('autocompletes the input field when a suggested option is clicked', () => {
    const inputElement =
      fixture.debugElement.query(By.css('input')).nativeElement;
    inputElement.dispatchEvent(new Event('focusin'));
    inputElement.value = 'unused';
    inputElement.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const options = overlayContainerElement.querySelectorAll('mat-option');
    expect(options.length).toBe(2); // ['unusedlabel', 'Add new label "unused"']
    options.item(0).dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(inputElement.value).toEqual('unusedlabel');
  });
});
