# Opentelemetry tracing for nestjs

## 使用方法
```JavaScript
/* src/main.ts */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestTracer } from './src/index';

async function bootstrap() {
  const nestTracer = new NestTracer(
    'service-name',
    { name: 'service-name', version: '0.0.1' },
    { type: 'jaeger', host: '192.168.8.207', port: 6832 }
  );
  const app = await NestFactory.create(AppModule);
  app.use(nestTracer.middleware);
  await app.listen(3000);
}
bootstrap();

```