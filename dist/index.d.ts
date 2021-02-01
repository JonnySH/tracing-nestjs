import { Tracer, Span, SpanContext } from '@opentelemetry/api';
import { ExporterConfig as JaegerExporterConfig } from '@opentelemetry/exporter-jaeger';
export interface ExporterConfig extends JaegerExporterConfig {
    type?: 'jaeger' | 'zipkin';
}
export declare class NestTracer {
    _tracer: Tracer;
    constructor(serviceName: string, pkg: {
        name: string;
        version: string;
    }, exporter: ExporterConfig);
    middleware(req: {
        method: any;
        headers: {
            traceparent: string;
        };
        tracer: Tracer;
        rootTraceSpan: Span;
        traceId: string;
    }, res: any, next: () => void): void;
    setFastifyReqAttributes(span: Span, req: any, getter?: (() => {
        'http.url': string;
        'http.method': string;
        'http.host': string;
        'net.peer.ip': string;
        [propName: string]: any;
    }) | {
        'http.url': string;
        'http.method': string;
        'http.host': string;
        'net.peer.ip': string;
        [propName: string]: any;
    } | undefined): void;
    defaultReqAttributesGeter(): {
        'http.url': string;
        'http.method': string;
        'http.host': string;
        'net.peer.ip': string;
        [propName: string]: any;
    };
    setFastifyResAttributes(span: Span, res: any, getter?: (() => {
        'http.status_code': string;
        [propName: string]: any;
    }) | {
        'http.status_code': string;
        [propName: string]: any;
    } | undefined): void;
    defaultResAttributesGeter(): {
        'http.status_code': string;
        [propName: string]: any;
    };
    getCurrentSpanHeader(spanContext: SpanContext): {
        traceparent: string | undefined;
    };
}
export declare function nestTracerMiddleware(serviceName: string, pkg: {
    name: string;
    version: string;
}, exporter: ExporterConfig): (req: {
    method: any;
    headers: {
        traceparent: string;
    };
    tracer?: Tracer;
    rootTraceSpan?: Span;
    traceId?: string;
    rootSpanHeader?: {
        traceparent: string | undefined;
    };
}, res: any, next: () => void) => void;
export interface NestTracerObject {
    tracer: Tracer;
    rootTraceSpan: Span;
    traceId: string;
    rootSpanHeader: {
        traceparent: string | undefined;
    };
}
