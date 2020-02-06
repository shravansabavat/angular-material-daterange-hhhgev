import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild,
  ViewEncapsulation
} from '@angular/core';
import { DateAdapter, MatCalendar, mixinColor } from '@angular/material';
import { DaterangeValue } from '../../models/daterange-value';
import { daterangeAnimations } from '../../models/daterange.animations';
import { DaterangeComponent } from '../daterange/daterange.component';
import { Subscription } from 'rxjs/Subscription';

export class DaterangeContentBase {
  constructor(public _elementRef: ElementRef) { }
}
export const _DaterangeContentMixinBase = mixinColor(DaterangeContentBase);

@Component({
  selector: 'daterange-content',
  templateUrl: './daterange-content.component.html',
  styleUrls: ['./daterange-content.component.scss'],
  host: {
    'class': 'daterange-content',
    '[@transformPanel]': '"enter"',
    '[class.daterange-content-touch]': 'daterange.touchUi',
  },
  animations: [
    daterangeAnimations.transformPanel,
    daterangeAnimations.fadeInCalendar,
  ],
  exportAs: 'matDatepickerContent',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DaterangeContentComponent<D>
  extends _DaterangeContentMixinBase
  implements AfterViewInit, OnDestroy {

  private _daterangeSelectedChangeSubscription: Subscription;

  @ViewChild('fromCalendar')
  fromCalendar: MatCalendar<D>;

  @ViewChild('toCalendar')
  toCalendar: MatCalendar<D>;

  private _daterange: DaterangeComponent<D>;
  get daterange(): DaterangeComponent<D> {
    return this._daterange;
  }
  set daterange(value: DaterangeComponent<D>) {
    if (value) {
      this._daterange = value;
      this._daterangeSelectedChangeSubscription = this._daterange._selectedChanged.subscribe((selectedValue: DaterangeValue<D>) => {
        this._onSelectedChanged(selectedValue);
      });
    }
  }

  fromDate: string;
  toDate: string;

  constructor(
    _elementRef: ElementRef,
    private _dateAdapter: DateAdapter<D>) {
    super(_elementRef);
  }

  ngAfterViewInit() {
    // this.fromCalendar._focusActiveCell();
  }

  ngOnDestroy() {
    if (this._daterangeSelectedChangeSubscription) {
      this._daterangeSelectedChangeSubscription.unsubscribe();
    }
  }

  _onSelectedChanged(value: DaterangeValue<D>): void {
    if (this._dateAdapter.compareDate(value.fromDate, value.toDate) === 0) {
      this.toCalendar._goToDateInView(value.fromDate, 'month');
    }
  }

  _select(calendar: MatCalendar<D>, event: any) {
    calendar.selected = event;

    this.daterange._select({
      fromDate: this.fromCalendar.selected,
      toDate: this.toCalendar.selected
    });
  }

  today() {
    const today = this._dateAdapter.today();
    this.daterange._select({
      fromDate: today,
      toDate: today
    });
  }

  apply() {

  }

  cancel() {

  }
}
