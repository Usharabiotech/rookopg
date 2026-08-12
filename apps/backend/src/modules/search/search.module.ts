import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { SearchController } from './search.controller';
import { SearchRepository } from './search.repository';
import { SearchService } from './search.service';

@Module({
  imports: [StorageModule],
  controllers: [SearchController],
  providers: [SearchService, SearchRepository],
})
export class SearchModule {}
