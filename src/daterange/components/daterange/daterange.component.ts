import { Directionality } from '@angular/cdk/bidi';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { ESCAPE, UP_ARROW } from '@angular/cdk/keycodes';
import {
    Overlay, OverlayConfig, OverlayRef, PositionStrategy, RepositionScrollStrategy, ScrollStrategy
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import {
    ChangeDetectionStrategy, ChangeDetectorRef, Component, ComponentRef, EventEmitter, Inject,
    InjectionToken, Input, NgZone, OnDestroy, Optional, Output, ViewContainerRef, ViewEncapsulation
} from '@angular/core';
import { DateAdapter } from '@angular/material';
import {
    DaterangeContentComponent
} from '../daterange-content/daterange-content.component';
import {
    DaterangeInputDirective
} from '../../directives/daterange-input.directive';
import { createMissingDateImplError } from '../../models/daterange-errors';
import { DaterangeValue } from '../../models/daterange-value';

import { merge } from 'rxjs/observable/merge';
import { filter, take } from 'rxjs/operators';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';

let daterangeUid = 0;


export const DATERANGE_SCROLL_STRATEGY = new InjectionToken<() => ScrollStrategy>('daterange-scroll-strategy');

export function DATERANGE_SCROLL_STRATEGY_PROVIDER_FACTORY(overlay: Overlay):
  () => RepositionScrollStrategy {
  return () => overlay.scrollStrategies.reposition();
}

export const DATERANGE_SCROLL_STRATEGY_PROVIDER = {
  provide: DATERANGE_SCROLL_STRATEGY,
  deps: [Overlay],
  useFactory: DATERANGE_SCROLL_STRATEGY_PROVIDER_FACTORY
};
// A partir d'Angular 6
// export const DATERANGE_SCROLL_STRATEGY =
//   new InjectionToken<() => ScrollStrategy>('daterange-scroll-strategy', {
//     providedIn: 'root',
//     factory: DATERANGE_SCROLL_STRATEGY_FACTORY,
//   });

// export function DATERANGE_SCROLL_STRATEGY_FACTORY(): () => ScrollStrategy {
//   const overlay = inject(Overlay);
//   return () => overlay.scrollStrategies.reposition();
// }

@Component({
  selector: 'daterange',
  template: '',
  exportAs: 'daterange',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class DaterangeComponent<D> implements OnDestroy {

  private _opened = false;
  private _focusedElementBeforeOpen: HTMLElement | null = null;
  private _inputSubscription = Subscription.EMPTY;
  private _validSelected: DaterangeValue<D> | null = null;

  // private _startAt: D | null;
  private _disabled: boolean;
  private _contentPortal: ComponentPortal<DaterangeContentComponent<D>>;
  private _popupComponentRef: ComponentRef<DaterangeContentComponent<D>> | null;

  id = `daterange-${daterangeUid++}`;
  _popupRef: OverlayRef;
  _daterangeInput: DaterangeInputDirective<D>;
  _minToDate: D | null;
  _toCalendarDateFilter: (date: D) => boolean;
  readonly _disabledChange = new Subject<boolean>();
  readonly _selectedChanged = new Subject<DaterangeValue<D>>();

  @Input()
  get disabled(): boolean {
    return this._disabled === undefined && this._daterangeInput ?
      this._daterangeInput.disabled : !!this._disabled;
  }
  set disabled(value: boolean) {
    const newValue = coerceBooleanProperty(value);

    if (newValue !== this._disabled) {
      this._disabled = newValue;
      this._disabledChange.next(newValue);
    }
  }

  @Input()
  get opened(): boolean {
    return this._opened;
  }
  set opened(value: boolean) {
    value ? this.open() : this.close();
  }

  get minToDate(): D | null {
    return this._minToDate;
  }

  get toCalendarDateFilter(): (date: D) => boolean {
    return this._toCalendarDateFilter;
  }

  @Output()
  readonly yearSelected: EventEmitter<D> = new EventEmitter<D>();

  @Output()
  readonly monthSelected: EventEmitter<D> = new EventEmitter<D>();

  @Output('opened')
  openedStream: EventEmitter<void> = new EventEmitter<void>();

  @Output('closed')
  closedStream: EventEmitter<void> = new EventEmitter<void>();

  /**
     * La date courante sélectionnée
     */
  get _selected(): DaterangeValue<D> | null {
    return this._validSelected;
  }
  set _selected(value: DaterangeValue<D> | null) {
    this._validSelected = value;
  }

  constructor(
    private _overlay: Overlay,
    private _ngZone: NgZone,
    private _viewContainerRef: ViewContainerRef,
    private _changeDetectorRef: ChangeDetectorRef,
    @Inject(DATERANGE_SCROLL_STRATEGY) private _scrollStrategy,
    @Optional() private _dateAdapter: DateAdapter<D>,
    @Optional() private _dir: Directionality,
    @Optional() @Inject(DOCUMENT) private _document: any
  ) {
    if (!this._dateAdapter) {
      throw createMissingDateImplError('DateAdapter');
    }
  }

  ngOnDestroy() {
    this.close();
    this._inputSubscription.unsubscribe();
    this._disabledChange.complete();

    if (this._popupRef) {
      this._popupRef.dispose();
      this._popupComponentRef = null;
    }
  }

  _select(range: DaterangeValue<D>, forceTriggerChange: boolean = false): void {
    const oldValue = this._selected ? this._selected : { fromDate: undefined, toDate: undefined };

    if (!range || (!range.fromDate && !range.toDate)) {
      range = { fromDate: this._dateAdapter.today(), toDate: this._dateAdapter.today() };
    } else if (!range.fromDate) {
      range = { fromDate: range.toDate, toDate: range.toDate };
    } else if (!range.toDate) {
      range = { fromDate: range.fromDate, toDate: range.fromDate };
    }

    // si la date de début est supérieure à la date de fin, on force la date de fin à la date de début
    if (this._dateAdapter.compareDate(range.fromDate, range.toDate) > 0) {
      range.toDate = range.fromDate;
    }

    this._selected = { fromDate: range.fromDate, toDate: range.toDate };
    // on met à jour la date de début du second calendrier
    this._minToDate = this._selected.fromDate;
    this._toCalendarDateFilter = (date: D) => this._dateAdapter.compareDate(date, this._selected.fromDate) >= 0;

    if (forceTriggerChange || !this._dateAdapter.sameDate(oldValue.fromDate, this._selected.fromDate) ||
      !this._dateAdapter.sameDate(oldValue.toDate, this._selected.toDate)) {
      this._selectedChanged.next(range);
    }
  }

  _selectYear(normalizedYear: D): void {
    this.yearSelected.emit(normalizedYear);
  }

  _selectMonth(normalizedMonth: D): void {
    this.monthSelected.emit(normalizedMonth);
  }

  _registerInput(input: DaterangeInputDirective<D>): void {
    if (this._daterangeInput) {
      throw Error('A Daterange can only be associated with a single input.');
    }

    this._daterangeInput = input;
    this._inputSubscription = this._daterangeInput._valueChange.subscribe((value: DaterangeValue<D>) => this._select(value));
  }

  open(): void {
    if (this._opened || this.disabled) {
      return;
    }

    if (!this._daterangeInput) {
      throw Error('Attempted to open an Daterange with no associated input.');
    }

    if (this._document) {
      this._focusedElementBeforeOpen = this._document.activeElement;
    }

    this._openAsPopup();
    this._opened = true;
    this.openedStream.emit();
  }

  close(): void {
    if (!this._opened) {
      return;
    }

    if (this._popupRef && this._popupRef.hasAttached()) {
      this._popupRef.detach();
    }

    if (this._contentPortal && this._contentPortal.isAttached) {
      this._contentPortal.detach();
    }

    const completeClose = () => {
      if (this._opened) {
        this._opened = false;
        this.closedStream.emit();
        this._focusedElementBeforeOpen = null;
      }
    };

    if (this._focusedElementBeforeOpen && typeof this._focusedElementBeforeOpen.focus === 'function') {
      this._focusedElementBeforeOpen.focus();
      setTimeout(completeClose);
    } else {
      completeClose();
    }
  }

  /** Ouvre le contenu en tant que popup */
  private _openAsPopup(): void {
    if (!this._contentPortal) {
      this._contentPortal = new ComponentPortal<DaterangeContentComponent<D>>(DaterangeContentComponent, this._viewContainerRef);
    }

    if (!this._popupRef) {
      this._createPopup();
    }

    if (!this._popupRef.hasAttached()) {
      this._popupRef.setDirection(this._getDirection());
      this._popupComponentRef = this._popupRef.attach(this._contentPortal);
      this._popupComponentRef.instance.daterange = this;
      this._select(this._daterangeInput.value, true);

      // Met à jour la position une fois que le contenu est rendu
      this._ngZone.onStable.asObservable().pipe(take(1)).subscribe(() => {
        this._popupRef.updatePosition();
      });
    }
  }

  /** Créé le popup */
  private _createPopup(): void {
    const overlayConfig = new OverlayConfig({
      positionStrategy: this._createPopupPositionStrategy(),
      hasBackdrop: true,
      backdropClass: 'mat-overlay-transparent-backdrop',
      direction: this._getDirection(),
      scrollStrategy: this._scrollStrategy(),
      panelClass: 'daterange-popup'
    });

    this._popupRef = this._overlay.create(overlayConfig);

    merge(
      this._popupRef.backdropClick(),
      this._popupRef.detachments(),
      this._popupRef.keydownEvents().pipe(filter(event => {
        return event.keyCode === ESCAPE || (this._daterangeInput && event.altKey && event.keyCode === UP_ARROW);
      }))
    ).subscribe(() => this.close());
  }

  /** créé la stratégie de positionnement du popup */
  private _createPopupPositionStrategy(): PositionStrategy {
    const fallbackOffset = this._daterangeInput._getPopupFallbackOffset();

    return this._overlay.position()
      .connectedTo(this._daterangeInput.getPopupConnectionElementRef(),
        { originX: 'start', originY: 'bottom' },
        { overlayX: 'start', overlayY: 'top' }
      )
      .withFallbackPosition(
        { originX: 'start', originY: 'top' },
        { overlayX: 'start', overlayY: 'bottom' },
        undefined,
        fallbackOffset
      )
      .withFallbackPosition(
        { originX: 'end', originY: 'bottom' },
        { overlayX: 'end', overlayY: 'top' }
      )
      .withFallbackPosition(
        { originX: 'end', originY: 'top' },
        { overlayX: 'end', overlayY: 'bottom' },
        undefined,
        fallbackOffset
      );
    // A partir d'Angular 6
    // return this._overlay.position()
    //   .flexibleConnectedTo(this._daterangeInput.getPopupConnectionElementRef())
    //   .withFlexibleDimensions(false)
    //   .withViewportMargin(8)
    //   .withPush(false)
    //   .withPositions([
    //     {
    //       originX: 'start',
    //       originY: 'bottom',
    //       overlayX: 'start',
    //       overlayY: 'top'
    //     },
    //     {
    //       originX: 'start',
    //       originY: 'top',
    //       overlayX: 'start',
    //       overlayY: 'bottom'
    //     },
    //     {
    //       originX: 'end',
    //       originY: 'bottom',
    //       overlayX: 'end',
    //       overlayY: 'top'
    //     },
    //     {
    //       originX: 'end',
    //       originY: 'top',
    //       overlayX: 'end',
    //       overlayY: 'bottom'
    //     }
    //   ]);
  }

  private _getValidDateOrNull(obj: any): D | null {
    return (this._dateAdapter.isDateInstance(obj) && this._dateAdapter.isValid(obj)) ? obj : null;
  }

  _getDirection(): any {
    return this._dir ? this._dir.value : 'ltr';
  }
}
