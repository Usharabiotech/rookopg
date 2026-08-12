import { Module } from '@nestjs/common';
import { PropertyModule } from '../property/property.module';
import { StorageModule } from '../storage/storage.module';
import { ImageService } from './image.service';
import { MediaController } from './media.controller';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';

@Module({
  imports: [PropertyModule, StorageModule],
  controllers: [MediaController],
  providers: [MediaService, MediaRepository, ImageService],
})
export class MediaModule {}
