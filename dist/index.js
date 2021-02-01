"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nestTracerMiddleware = exports.NestTracer = void 0;
const api_1 = require("@opentelemetry/api");
const node_1 = require("@opentelemetry/node");
const tracing_1 = require("@opentelemetry/tracing");
const exporter_jaeger_1 = require("@opentelemetry/exporter-jaeger");
const core_1 = require("@opentelemetry/core");
const get = require('lodash.get');
class NestTracer {
    constructor(serviceName, pkg, exporter) {
        const provider = new node_1.NodeTracerProvider();
        let _exporter;
        if (exporter.type === 'jaeger') {
            const _options = Object.assign({}, exporter);
            delete _options.type;
            _options.serviceName = serviceName;
            _exporter = new exporter_jaeger_1.JaegerExporter(_options);
        }
        else {
            throw new Error('ExporterNotJaeger');
        }
        provider.addSpanProcessor(new tracing_1.SimpleSpanProcessor(_exporter));
        provider.register();
        this._tracer = api_1.trace.getTracer(pkg.name, pkg.version);
    }
    middleware(req, res, next) {
        console.log('>>>> middleware _tracer: ', this._tracer);
        const rootSpanName = `HTTP ${req.method}`;
        const parentContext = core_1.parseTraceParent(req.headers.traceparent);
        const options = { kind: api_1.SpanKind.SERVER };
        let rootSpan;
        if (parentContext) {
            rootSpan = this._tracer.startSpan(rootSpanName, options, api_1.setSpanContext(api_1.context.active(), parentContext));
        }
        else {
            rootSpan = this._tracer.startSpan(rootSpanName, options);
        }
        this.setFastifyReqAttributes(rootSpan, req);
        req.tracer = this._tracer;
        req.rootTraceSpan = rootSpan;
        req.traceId = rootSpan.context().traceId;
        next();
        rootSpan.end();
    }
    setFastifyReqAttributes(span, req, getter) {
        const _geter = getter
            ? typeof getter === 'function'
                ? getter()
                : getter
            : this.defaultReqAttributesGeter();
        for (const key of Object.keys(_geter)) {
            span.setAttribute(key, get(req, `${_geter[key]}`));
        }
    }
    defaultReqAttributesGeter() {
        return {
            'http.url': 'url',
            'http.method': 'method',
            'http.host': 'headers.host',
            'net.peer.ip': 'ip',
            'http.flavor': 'httpVersion',
        };
    }
    setFastifyResAttributes(span, res, getter) {
        const _geter = getter
            ? typeof getter === 'function'
                ? getter()
                : getter
            : this.defaultResAttributesGeter();
        for (const key of Object.keys(_geter)) {
            span.setAttribute(key, get(res, `${_geter[key]}`));
        }
    }
    defaultResAttributesGeter() {
        return {
            'http.status_code': 'statusCode',
        };
    }
    getCurrentSpanHeader(spanContext) {
        let traceparent;
        if (spanContext) {
            const VERSION = '00';
            traceparent = `${VERSION}-${spanContext.traceId}-${spanContext.spanId}-0${Number(spanContext.traceFlags || api_1.TraceFlags.NONE).toString(16)}`;
        }
        return { traceparent };
    }
}
exports.NestTracer = NestTracer;
let nestTracer;
function nestTracerMiddleware(serviceName, pkg, exporter) {
    if (!nestTracer) {
        nestTracer = new NestTracer(serviceName, pkg, exporter);
    }
    return function (req, res, next) {
        const rootSpanName = `HTTP ${req.method}`;
        const parentContext = core_1.parseTraceParent(req.headers.traceparent);
        console.log('parse parent trace: ', req.headers.traceparent, parentContext);
        const options = { kind: api_1.SpanKind.SERVER };
        let rootSpan;
        if (parentContext) {
            rootSpan = nestTracer._tracer.startSpan(rootSpanName, options, api_1.setSpanContext(api_1.context.active(), parentContext));
        }
        else {
            rootSpan = nestTracer._tracer.startSpan(rootSpanName, options);
        }
        nestTracer.setFastifyReqAttributes(rootSpan, req);
        req.tracer = nestTracer._tracer;
        req.rootTraceSpan = rootSpan;
        req.traceId = rootSpan.context().traceId;
        req.rootSpanHeader = nestTracer.getCurrentSpanHeader(rootSpan.context());
        next();
        nestTracer.setFastifyResAttributes(rootSpan, res);
        if (res.statusCode === 200) {
            rootSpan.setStatus({ code: api_1.StatusCode.OK });
        }
        else {
            rootSpan.setStatus({ code: api_1.StatusCode.ERROR });
        }
        console.log('>> rootSpanHeader ', req.rootSpanHeader);
        rootSpan.end();
    };
}
exports.nestTracerMiddleware = nestTracerMiddleware;
//# sourceMappingURL=index.js.map