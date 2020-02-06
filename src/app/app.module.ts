import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material';
import { DaterangeModule } from '../daterange/daterange.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatMomentDateModule } from '@angular/material-moment-adapter';

@NgModule({
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    MatMomentDateModule,
    DaterangeModule,
    MatInputModule],
  declarations: [AppComponent],
  bootstrap: [AppComponent]
})
export class AppModule { }
