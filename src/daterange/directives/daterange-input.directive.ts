import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { DOWN_ARROW } from '@angular/cdk/keycodes';
import {
    AfterContentInit, Directive, ElementRef, EventEmitter, forwardRef, Inject, Input, OnDestroy,
    Optional, Output
} from '@angular/core';
import { ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
    DateAdapter, MAT_DATE_FORMATS, MAT_INPUT_VALUE_ACCESSOR, MatDateFormats, MatFormField
} from '@angular/material';
import {
    DaterangeComponent
} from '../components/daterange/daterange.component';
import { createMissingDateImplError } from '../models/daterange-errors';
import { DaterangeValue } from '../models/daterange-value';

import { Subscription } from 'rxjs/Subscription';

export const DATERANGE_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => DaterangeInputDirective),
  multi: true
};

export const DATERANGE_VALIDATORS: any = {
  provide: NG_VALIDATORS,
  useExisting: forwardRef(() => DaterangeInputDirective),
  multi: true
};

export class DaterangeInputEvent<D> {
  value: DaterangeValue<D> | null;

  constructor(
    public target: DaterangeInputDirective<D>,
    public targetElement: HTMLElement) {
    this.value = this.target.value;
  }
}

/**
 * Directive utilisée pour connecter un input à un ebp-daterange
 *
 * @export
 * @class DaterangeInputDirective
 * @implements {AfterContentInit}
 * @implements {ControlValueAccessor}
 * @implements {OnDestroy}
 * @implements {Validator}
 * @template D
 */
@Directive({
  selector: 'input[daterange]',
  providers: [
    DATERANGE_VALUE_ACCESSOR,
    DATERANGE_VALIDATORS,
    { provide: MAT_INPUT_VALUE_ACCESSOR, useExisting: DaterangeInputDirective }
  ],
  host: {
    'autocomplete': 'off',
    '[attr.aria-autocomplete]': 'null',
    '[attr.aria-haspopup]': 'true',
    '[attr.aria-owns]': '(_daterange?.opened && _daterange.id) || null',
    '[attr.min]': 'min ? _dateAdapter.toIso8601(min) : null',
    '[attr.max]': 'max ? _dateAdapter.toIso8601(max) : null',
    '[disabled]': 'disabled',
    '(input)': '_onInput($event.target.value)',
    '(change)': '_onChange()',
    '(blur)': '_onBlur()',
    '(keydown)': '_onKeydown($event)',
  },
  exportAs: 'daterange'
})
export class DaterangeInputDirective<D> implements AfterContentInit, ControlValueAccessor, OnDestroy {

  private _localeSubscription = Subscription.EMPTY;
  private _daterangeSubscription = Subscription.EMPTY;
  // private _lastValueValid = false;
  private _validatorOnChange = () => { };
  private _onTouched = () => { };

  _valueChange = new EventEmitter<DaterangeValue<D> | null>();
  _disabledChange = new EventEmitter<boolean>();

  /**
 * Emis quand un changement est effectué dans l'inputa `change` event is fired on this `<input>`.
 */
  @Output()
  readonly dateChange = new EventEmitter<DaterangeInputEvent<D>>();

  /**
   * Emis quand une valeur a été saisi dans l'input
   */
  @Output()
  readonly dateInput = new EventEmitter<DaterangeInputEvent<D>>();

  private _daterange: DaterangeComponent<D>;
  private _value: DaterangeValue<D> | null;
  private _disabled: boolean;
  private _cvaOnChange: (value: any) => void = () => { };

  /**
   * Daterange qui est associé à l'input
   */
  @Input('daterange')
  set daterange(value: DaterangeComponent<D>) {
    this.registerDaterange(value);
  }

  /**
   * Valeur de l'input
   */
  @Input()
  get value(): DaterangeValue<D> | null { return this._value; }
  set value(value: DaterangeValue<D> | null) {
    value.fromDate = this._dateAdapter.deserialize(value.fromDate);
    value.toDate = this._dateAdapter.deserialize(value.toDate);
    // this._lastValueValid = !value ||
    //   (this._dateAdapter.isValid(value.fromDate) && this._dateAdapter.isValid(value.toDate));
    value.fromDate = this._getValidDateOrNull(value.fromDate);
    value.toDate = this._getValidDateOrNull(value.toDate);
    const oldDate = this.value ? this.value : { fromDate: undefined, toDate: undefined };
    this._value = value;
    this._formatValue(value);

    if (!this._dateAdapter.sameDate(oldDate.fromDate, value.fromDate) || !this._dateAdapter.sameDate(oldDate.toDate, value.toDate)) {
      this._valueChange.emit(value);
    }
  }

  @Input()
  get disabled(): boolean { return !!this._disabled; }
  set disabled(value: boolean) {
    const newValue = coerceBooleanProperty(value);
    const element = this._elementRef.nativeElement;

    if (this._disabled !== newValue) {
      this._disabled = newValue;
      this._disabledChange.emit(newValue);
    }

    // We need to null check the `blur` method, because it's undefined during SSR.
    if (newValue && element.blur) {
      // Normally, native input elements automatically blur if they turn disabled. This behavior
      // is problematic, because it would mean that it triggers another change detection cycle,
      // which then causes a changed after checked error if the input element was focused before.
      element.blur();
    }
  }

  /**
   * Constructeur
   * @param _elementRef
   * @param _dateAdapter
   * @param _dateFormats
   * @param _formField
   */
  constructor(
    private _elementRef: ElementRef,
    @Optional() public _dateAdapter: DateAdapter<D>,
    @Optional() @Inject(MAT_DATE_FORMATS) private _dateFormats: MatDateFormats,
    @Optional() private _formField: MatFormField) {
    if (!this._dateAdapter) {
      throw createMissingDateImplError('DateAdapter');
    }
    if (!this._dateFormats) {
      throw createMissingDateImplError('MAT_DATE_FORMATS');
    }

    // Update the displayed date when the locale changes.
    this._localeSubscription = _dateAdapter.localeChanges.subscribe(() => {
      this.value = this.value;
    });
  }

  ngAfterContentInit() {
    if (this._daterange) {
      this._daterangeSubscription = this._daterange._selectedChanged.subscribe((selected: DaterangeValue<D>) => {
        this.value = selected;
        this._cvaOnChange(selected);
        this._onTouched();
        this.dateInput.emit(new DaterangeInputEvent(this, this._elementRef.nativeElement));
        this.dateChange.emit(new DaterangeInputEvent(this, this._elementRef.nativeElement));
      });
    }
  }

  ngOnDestroy() {
    this._daterangeSubscription.unsubscribe();
    this._localeSubscription.unsubscribe();
    this._valueChange.complete();
    this._disabledChange.complete();
  }

  registerOnValidatorChange(fn: () => void): void {
    this._validatorOnChange = fn;
  }

  getPopupConnectionElementRef(): ElementRef {
    return this.getConnectedOverlayOrigin();
  }

  /**
  * Retourne l'élément qui est connecté au popup du daterange
  */
  getConnectedOverlayOrigin(): ElementRef {
    return this._elementRef;
    // return this._formField ? this._formField.getConnectedOverlayOrigin() : this._elementRef;
  }

  writeValue(value: DaterangeValue<D>): void {
    this.value = value;
  }

  registerOnChange(fn: (value: any) => void): void {
    this._cvaOnChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  _getPopupFallbackOffset(): number {
    return this._formField ? -this._formField._inputContainerRef.nativeElement.clientHeight : 0;
  }

  _onKeydown(event: KeyboardEvent) {
    if (event.altKey && event.keyCode === DOWN_ARROW) {
      this._daterange.open();
      event.preventDefault();
    }
  }

  _onFocus(event: Event): void {
    if (this._daterange && !this.disabled) {
      this._daterange.open();
      event.stopPropagation();
    }
  }

  _onInput(value: string) {
    const values = value.split(' - ');
    const date: DaterangeValue<D> = { fromDate: undefined, toDate: undefined };
    if (values.length === 0) {
      // this._lastValueValid = false;
      return;
    }

    date.fromDate = this._dateAdapter.parse(values[0], this._dateFormats.parse.dateInput);
    date.fromDate = this._getValidDateOrNull(date.fromDate);
    if (values.length === 2) {
      date.toDate = this._dateAdapter.parse(values[1], this._dateFormats.parse.dateInput);
      date.toDate = this._getValidDateOrNull(date.toDate);
    }

    // this._lastValueValid =
    //   date.fromDate &&
    //   date.toDate &&
    //   this._dateAdapter.isValid(date.fromDate) &&
    //   this._dateAdapter.isValid(date.toDate);

    if (!this._dateAdapter.sameDate(date.fromDate, this._value ? this._value.fromDate : undefined) ||
      !this._dateAdapter.sameDate(date.toDate, this._value ? this._value.toDate : undefined)) {
      this._value = date;
      this._cvaOnChange(date);
      this._valueChange.emit(date);
      this.dateInput.emit(new DaterangeInputEvent(this, this._elementRef.nativeElement));
    }
  }

  _onChange() {
    this.dateChange.emit(new DaterangeInputEvent(this, this._elementRef.nativeElement));
  }

  _getThemePalette() {
    return this._formField ? this._formField.color : undefined;
  }

  _onBlur() {
    if (this.value) {
      this._formatValue(this.value);
    }

    this._onTouched();
  }

  private _formatValue(value: DaterangeValue<D> | null) {
    this._elementRef.nativeElement.value =
      value ?
        `${this._formatDateValue(value.fromDate)} - ${this._formatDateValue(value.toDate)}` : '';
  }

  private _formatDateValue(date: D) {
    return date ? this._dateAdapter.format(date, this._dateFormats.display.dateInput) : '';
  }

  private _getValidDateOrNull(obj: any): D | null {
    return (this._dateAdapter.isDateInstance(obj) && this._dateAdapter.isValid(obj)) ? obj : null;
  }

  private registerDaterange(value: DaterangeComponent<D>) {
    if (value) {
      this._daterange = value;
      this._daterange._registerInput(this);
    }
  }

}
