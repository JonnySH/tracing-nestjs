# Opentelemetry tracing for nestjs

- 可在nestjs的express和fastify框架下使用
- 可以通过 opentelemetry 标准的 HTTP 请求头 traceparent 整合到上级链路中。注意如果需要将本服务依赖其他微服务也加入tracing，需要传递本服务的tracing context中，具体可以参看本代码中的 nestTracerMiddleware

## 使用方法 express
```JavaScript
/* src/main.ts */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestTracer } from './src/index';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(
    nestTracerMiddleware(
      'service-name',
      { name: 'service-name', version: '0.0.1' },
      {
        type: 'jaeger',
        serviceName: 'service-name',
        host: '192.168.8.207',
        port: 6832,
      },
    ),
  );
  await app.listen(3000);
}
bootstrap();

```

## 使用方法 express
```JavaScript
/* src/main.ts */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { nestTracerMiddleware } from 'tracing-nestjs';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  app.use(
    nestTracerMiddleware(
      'service-name',
      { name: 'service-name', version: '0.0.1' },
      {
        type: 'jaeger',
        serviceName: 'service-name',
        host: '192.168.8.207',
        port: 6832,
      },
    ),
  );
  await app.listen(3000);
}
bootstrap();
```