import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
    AfterContentInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges,
    OnDestroy, SimpleChanges, ViewEncapsulation
} from '@angular/core';
import {
    DaterangeComponent
} from '../daterange/daterange.component';

import { merge } from 'rxjs/observable/merge';
import { of } from 'rxjs/observable/of';
import { Subscription } from 'rxjs/Subscription';

@Component({
  selector: 'daterange-toggle',
  templateUrl: './daterange-toggle.component.html',
  styleUrls: ['./daterange-toggle.component.scss'],
  host: {
    'class': 'daterange-toggle',
    '[class.daterange-toggle-active]': 'daterange && daterange.opened',
    '[class.mat-accent]': 'daterange && daterange.color === "accent"',
    '[class.mat-warn]': 'daterange && daterange.color === "warn"',
  },
  exportAs: 'ebpDaterangeToggle',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DaterangeToggleComponent<D> implements AfterContentInit, OnChanges, OnDestroy {

  private _stateChanges = Subscription.EMPTY;
  private _disabled: boolean;

  @Input('for')
  daterange: DaterangeComponent<D>;

  @Input()
  get disabled(): boolean {
    return this._disabled === undefined ? this.daterange.disabled : !!this._disabled;
  }
  set disabled(value: boolean) {
    this._disabled = coerceBooleanProperty(value);
  }

  constructor(private _changeDetectorRef: ChangeDetectorRef) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.daterange) {
      this._watchStateChanges();
    }
  }

  ngOnDestroy() {
    this._stateChanges.unsubscribe();
  }

  ngAfterContentInit() {
    this._watchStateChanges();
  }

  _open(event: Event): void {
    if (this.daterange && !this.disabled) {
      this.daterange.open();
      event.stopPropagation();
    }
  }

  private _watchStateChanges() {
    const daterangeDisabled = this.daterange ? this.daterange._disabledChange : of();
    const inputDisabled = this.daterange && this.daterange._daterangeInput ?
      this.daterange._daterangeInput._disabledChange : of();

    const daterangeToggled = this.daterange ?
      merge(this.daterange.openedStream, this.daterange.closedStream) : of();

      this._stateChanges.unsubscribe();
      this._stateChanges = merge(
        daterangeDisabled,
        inputDisabled,
        daterangeToggled
      ).subscribe(() => this._changeDetectorRef.markForCheck());
  }
}
