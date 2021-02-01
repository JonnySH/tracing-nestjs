import {
  Tracer,
  trace,
  setSpanContext,
  context,
  Span,
  SpanKind,
  StatusCode,
  TraceFlags,
  SpanContext,
} from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/node';
import { SimpleSpanProcessor } from '@opentelemetry/tracing';
import {
  JaegerExporter,
  ExporterConfig as JaegerExporterConfig,
} from '@opentelemetry/exporter-jaeger';
import { parseTraceParent } from '@opentelemetry/core';
const get = require('lodash.get');

export interface ExporterConfig extends JaegerExporterConfig {
  type?: 'jaeger' | 'zipkin';
}

export class NestTracer {
  public _tracer: Tracer;
  constructor(
    serviceName: string,
    pkg: { name: string; version: string },
    exporter: ExporterConfig,
  ) {
    const provider = new NodeTracerProvider();
    let _exporter;
    if (exporter.type === 'jaeger') {
      const _options = Object.assign({}, exporter);
      delete _options.type;
      _options.serviceName = serviceName;
      _exporter = new JaegerExporter(_options);
    } else {
      // 当前仅支持jaeger
      throw new Error('ExporterNotJaeger');
    }
    provider.addSpanProcessor(new SimpleSpanProcessor(_exporter));
    // Initialize the OpenTelemetry APIs to use the NodeTracerProvider bindings
    provider.register();
    this._tracer = trace.getTracer(pkg.name, pkg.version);
  }
  /**
   * 发现使用该类的实例方法middleware注册全局的函数中间件的时候，内部的this为undefined，未知为何。所以该方法暂不可使用。
   * @param req
   * @param res
   * @param next
   */
  // eslint-disable-next-line prettier/prettier
  public middleware (req: { method: any; headers: { traceparent: string; }; tracer: Tracer; rootTraceSpan: Span; traceId: string; }, res: any, next: () => void) {
    console.log('>>>> middleware _tracer: ', this._tracer);
    const rootSpanName = `HTTP ${req.method}`;
    const parentContext = parseTraceParent(req.headers.traceparent);
    const options = { kind: SpanKind.SERVER };
    // parentContext 起到链接整个链路的作用
    // 注意如果本服务需要调用第三方服务，并且希望第三方也加入tracing，则需要本服务主动发送 traceparent 头部，并且第三方服务需要实现整合的功能
    let rootSpan: Span;
    if (parentContext) {
      rootSpan = this._tracer.startSpan(
        rootSpanName,
        options,
        setSpanContext(context.active(), parentContext),
      );
    } else {
      rootSpan = this._tracer.startSpan(rootSpanName, options);
    }
    // 这里假设使用fastify框架进行http参数的读取，未知是否也适用express框架，待测试
    this.setFastifyReqAttributes(rootSpan, req);
    // 在req中挂载三个对象, 使用方法可以追溯原文档
    req.tracer = this._tracer;
    req.rootTraceSpan = rootSpan;
    req.traceId = rootSpan.context().traceId;
    next();
    rootSpan.end();
  }

  setFastifyReqAttributes(
    span: Span,
    req: any,
    getter?:
      | (() => {
          'http.url': string;
          'http.method': string;
          'http.host': string;
          'net.peer.ip': string;
          [propName: string]: any;
        })
      | {
          'http.url': string;
          'http.method': string;
          'http.host': string;
          'net.peer.ip': string;
          [propName: string]: any;
        }
      | undefined,
  ) {
    const _geter = getter
      ? typeof getter === 'function'
        ? getter()
        : getter
      : this.defaultReqAttributesGeter();
    for (const key of Object.keys(_geter)) {
      span.setAttribute(key, get(req, `${_geter[key]}`));
    }
  }
  /**
   * 可以自定义该方法来自定义写入链路的tags
   */
  defaultReqAttributesGeter(): {
    'http.url': string;
    'http.method': string;
    'http.host': string;
    'net.peer.ip': string;
    [propName: string]: any;
  } {
    return {
      'http.url': 'url',
      'http.method': 'method',
      'http.host': 'headers.host',
      'net.peer.ip': 'ip',
      'http.flavor': 'httpVersion',
    };
  }

  setFastifyResAttributes(
    span: Span,
    res: any,
    getter?:
      | (() => {
          'http.status_code': string;
          [propName: string]: any;
        })
      | {
          'http.status_code': string;
          [propName: string]: any;
        }
      | undefined,
  ) {
    const _geter = getter
      ? typeof getter === 'function'
        ? getter()
        : getter
      : this.defaultResAttributesGeter();
    for (const key of Object.keys(_geter)) {
      span.setAttribute(key, get(res, `${_geter[key]}`));
    }
  }
  defaultResAttributesGeter(): {
    'http.status_code': string;
    [propName: string]: any;
  } {
    return {
      // response
      'http.status_code': 'statusCode',
    };
  }
  getCurrentSpanHeader(
    spanContext: SpanContext,
  ): { traceparent: string | undefined } {
    let traceparent;
    if (spanContext) {
      const VERSION = '00';
      traceparent = `${VERSION}-${spanContext.traceId}-${
        spanContext.spanId
      }-0${Number(spanContext.traceFlags || TraceFlags.NONE).toString(16)}`;
    }
    return { traceparent };
  }
}

let nestTracer: NestTracer;
// 全局中间件目前只能是函数中间价形式? 所以这里把类形式的中间件凑出来写成函数形式
export function nestTracerMiddleware(
  serviceName: string,
  pkg: { name: string; version: string },
  exporter: ExporterConfig,
) {
  if (!nestTracer) {
    nestTracer = new NestTracer(serviceName, pkg, exporter);
  }
  return function (
    req: {
      method: any;
      headers: { traceparent: string };
      tracer?: Tracer;
      rootTraceSpan?: Span;
      traceId?: string;
      rootSpanHeader?: { traceparent: string | undefined };
    },
    res: any,
    next: () => void,
  ) {
    const rootSpanName = `HTTP ${req.method}`;
    const parentContext = parseTraceParent(req.headers.traceparent);
    console.log('parse parent trace: ', req.headers.traceparent, parentContext);
    const options = { kind: SpanKind.SERVER };
    // parentContext 起到链接整个链路的作用
    // 注意如果本服务需要调用第三方服务，并且希望第三方也加入tracing，则需要本服务主动发送 traceparent 头部，并且第三方服务需要实现整合的功能
    let rootSpan: Span;
    if (parentContext) {
      rootSpan = nestTracer._tracer.startSpan(
        rootSpanName,
        options,
        setSpanContext(context.active(), parentContext),
      );
    } else {
      rootSpan = nestTracer._tracer.startSpan(rootSpanName, options);
    }
    // 这里假设使用fastify框架进行http参数的读取，未知是否也适用express框架，待测试
    nestTracer.setFastifyReqAttributes(rootSpan, req);
    // 在req中挂载三个对象, 使用方法可以追溯原文档
    req.tracer = nestTracer._tracer;
    req.rootTraceSpan = rootSpan;
    req.traceId = rootSpan.context().traceId;
    req.rootSpanHeader = nestTracer.getCurrentSpanHeader(rootSpan.context());
    next();
    nestTracer.setFastifyResAttributes(rootSpan, res);
    if (res.statusCode === 200) {
      rootSpan.setStatus({ code: StatusCode.OK });
    } else {
      rootSpan.setStatus({ code: StatusCode.ERROR });
    }
    console.log('>> rootSpanHeader ', req.rootSpanHeader);
    rootSpan.end();
  };
}

export interface NestTracerObject {
  tracer: Tracer;
  rootTraceSpan: Span;
  traceId: string;
  rootSpanHeader: { traceparent: string | undefined };
}
