import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './entities/user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { DoctorsController } from './doctors.controller';
import { EncryptionModule } from '../../core/encryption/encryption.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    EncryptionModule,
    NotificationModule,
  ],
  controllers: [UserController, DoctorsController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
