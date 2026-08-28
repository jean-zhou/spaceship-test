import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashbordModule } from './dashbord/dashbord.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'data/app.sqlite',
    }),
    DashbordModule
  ],
})
export class AppModule { }
