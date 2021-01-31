import {
  Tracer,
  trace,
  setSpanContext,
  context,
  Span,
  SpanKind,
} from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/node';
import { SimpleSpanProcessor } from '@opentelemetry/tracing';
import {
  JaegerExporter,
  ExporterConfig as JaegerExporterConfig,
} from '@opentelemetry/exporter-jaeger';
import { parseTraceParent } from '@opentelemetry/core';

export interface ExporterConfig extends JaegerExporterConfig {
  type?: 'jaeger' | 'zipkin';
}

export class NestTracer {
  private _tracer: Tracer;
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
  middleware(req: { method: any; headers: { traceparent: string; }; tracer: Tracer; rootTraceSpan: Span; traceId: string; }, res: any, next: () => void) {
    const rootSpanName = `HTTP ${req.method}`;
    const parentContext = parseTraceParent(req.headers.traceparent);
    const options = { kind: SpanKind.SERVER };
    // parentContext 起到链接整个链路的作用
    // 注意如果本服务需要调用第三方服务，并且希望第三方也加入tracing，则需要本服务主动发送 traceparent 头部，并且第三方服务需要实现整合的功能
    let rootSpan:Span;
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
    this.setFastifyHttpAttributes(rootSpan, req);
    // 在req中挂载三个对象, 使用方法可以追溯原文档
    req.tracer = this._tracer;
    req.rootTraceSpan = rootSpan;
    req.traceId = rootSpan.context().traceId;
    next();
    rootSpan.end();
  }

  setFastifyHttpAttributes(span: Span, req: any, getter?: (() => {'http.url': string,'http.method': string, 'http.host': string, 'net.peer.ip': string, [propName: string]: any}) | {'http.url': string,'http.method': string, 'http.host': string, 'net.peer.ip': string, [propName: string]: any} | undefined) {
    const _geter = getter ? typeof getter === 'function' ? getter() : getter : this.defaultAttributesGeter()
    for (const key in Object.keys(_geter)) {
      span.setAttribute(key, req[_geter[key]]);
    }
  }
  /**
   * 可以自定义该方法来自定义写入链路的tags
   */
  defaultAttributesGeter(): {'http.url': string,'http.method': string, 'http.host': string, 'net.peer.ip': string, [propName: string]: any} {
    return {
      'http.url': 'url',
      'http.method': 'method',
      'http.host': 'headers.host',
      'net.peer.ip': 'ip',
    }
  }
}

export interface NestTracerObject {
  tracer: Tracer;
  rootTraceSpan: Span;
  traceId: string;
}
