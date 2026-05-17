import { Global, Module } from '@nestjs/common';
import { CsrfMiddleware } from './csrf.middleware';

@Global()
@Module({
  providers: [CsrfMiddleware],
  exports: [CsrfMiddleware],
})
export class CsrfModule {}
