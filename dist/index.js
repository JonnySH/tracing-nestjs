"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NestTracer = void 0;
const api_1 = require("@opentelemetry/api");
const node_1 = require("@opentelemetry/node");
const tracing_1 = require("@opentelemetry/tracing");
const exporter_jaeger_1 = require("@opentelemetry/exporter-jaeger");
const core_1 = require("@opentelemetry/core");
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
            // 当前仅支持jaeger
            throw new Error('ExporterNotJaeger');
        }
        provider.addSpanProcessor(new tracing_1.SimpleSpanProcessor(_exporter));
        // Initialize the OpenTelemetry APIs to use the NodeTracerProvider bindings
        provider.register();
        this._tracer = api_1.trace.getTracer(pkg.name, pkg.version);
    }
    middleware(req, res, next) {
        const rootSpanName = `HTTP ${req.method}`;
        const parentContext = core_1.parseTraceParent(req.headers.traceparent);
        const options = { kind: api_1.SpanKind.SERVER };
        // parentContext 起到链接整个链路的作用
        // 注意如果本服务需要调用第三方服务，并且希望第三方也加入tracing，则需要本服务主动发送 traceparent 头部，并且第三方服务需要实现整合的功能
        let rootSpan;
        if (parentContext) {
            rootSpan = this._tracer.startSpan(rootSpanName, options, api_1.setSpanContext(api_1.context.active(), parentContext));
        }
        else {
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
    setFastifyHttpAttributes(span, req, getter) {
        const _geter = getter ? typeof getter === 'function' ? getter() : getter : this.defaultAttributesGeter();
        for (const key in Object.keys(_geter)) {
            span.setAttribute(key, req[_geter[key]]);
        }
    }
    /**
     * 可以自定义该方法来自定义写入链路的tags
     */
    defaultAttributesGeter() {
        return {
            'http.url': 'url',
            'http.method': 'method',
            'http.host': 'headers.host',
            'net.peer.ip': 'ip',
        };
    }
}
exports.NestTracer = NestTracer;
