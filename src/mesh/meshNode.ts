import tomcat from '@gostarehnegar/tomcat'

export class DataService {

}
export class DataServiceCollection {
    public availableServices: serviceDescription[] = []
    public runningServices: serviceDescription[] = []
    constructor(){
        this.availableServices.push({category="data"})
    }
    async getCapability(query) {
        if (query.serviceDefinition.category == 'data' && query.serviceDefinition.parameters["exchange"] == 'coinex') {
            return { acceptable: true, load: 0 }
        }
        else {
            return { acceptable: false, load: 1 }
        }
    }
    async executeservice(order) {
        this.addService(order.serviceDefinition)
        await Promise.resolve()
        return { started: Date.now() }
    }
    queryService() {
        return this.runningServices.map(x => x.serviceDefinition)
    }
    addService = (serviceDef: tomcat.Infrastructure.Mesh.ServiceDefinition) => {
        const params = serviceDef.parameters
        const pipeline = new tomcat.Domain.Pipes.Pipeline()
            .from(params["exchange"] as tomcat.Domain.Base.Exchanges, params["market"] as tomcat.Domain.Base.Markets, params["symbol"] as tomcat.Domain.Base.Symbols, params["interval"] as tomcat.Domain.Base.Intervals)
        const servicedes: serviceDescription = { pipeline: pipeline, serviceDefinition: serviceDef, cancel: false }
        servicedes.waitHandle = pipeline.startEx(null, () => {
            return servicedes.cancel
        })
        this.runningServices.push(servicedes)
    }
}


export type serviceDescription = {
    pipeline: tomcat.Domain.Pipes.Pipeline,
    serviceDefinition: tomcat.Infrastructure.Mesh.ServiceDefinition
    cancel: boolean
    waitHandle?: Promise<unknown>
    category : string
}

const runningServices: serviceDescription[] = []
const addService = (serviceDef: tomcat.Infrastructure.Mesh.ServiceDefinition) => {
    const params = serviceDef.parameters
    const pipeline = new tomcat.Domain.Pipes.Pipeline()
        .from(params["exchange"] as tomcat.Domain.Base.Exchanges, params["market"] as tomcat.Domain.Base.Markets, params["symbol"] as tomcat.Domain.Base.Symbols, params["interval"] as tomcat.Domain.Base.Intervals)
    const servicedes: serviceDescription = { pipeline: pipeline, serviceDefinition: serviceDef, cancel: false }
    servicedes.waitHandle = pipeline.startEx(null, () => {
        return servicedes.cancel
    })
    runningServices.push(servicedes)
}
const matchServiceDefs = (a: tomcat.Infrastructure.Mesh.ServiceDefinition, b: tomcat.Domain.Contracts.dataRequestPayload) => {
    return b.exchange == a.parameters["exchange"] && b.market == a.parameters["market"] && b.interval == a.parameters["interval"] && b.symbol == a.parameters["symbol"]
}
const queryPipeline = (payload: tomcat.Domain.Contracts.dataRequestPayload) => {
    return runningServices.find(x => matchServiceDefs(x.serviceDefinition, payload))
}
(async () => {

    const port = 8081;
    const node = tomcat.hosts.getHostBuilder('client1')
        .addMessageBus(cfg => {
            cfg.endpoint = "node";
            cfg.transports.websocket.url = `http://localhost:${port}/hub`;
        })
        .addMeshNode((cfg) => {
            cfg.serviceCapability = async (query) => {
                if (query.serviceDefinition.category == 'data' && query.serviceDefinition.parameters["exchange"] == 'coinex') {
                    return { acceptable: true, load: 0 }
                }
                else {
                    return { acceptable: false, load: 1 }
                }
            }
            cfg.executeservice = async (order) => {
                addService(order.serviceDefinition)
                await Promise.resolve()
                return { started: Date.now() }
            }
            cfg.queryService = () => {
                return runningServices.map(x => x.serviceDefinition)
            }
        })
        .build();
    node.bus.subscribe(tomcat.Domain.Contracts.requestData(null).topic, async (ctx) => {
        const m = ctx.message.cast<tomcat.Domain.Contracts.dataRequestPayload>()
        const pipeline = queryPipeline(m)
        if (!pipeline) {
            ctx.reject("I cannot process the requested data")
        }
        const stream = node.services.getStoreFactory().createStore({ provider: 'redis' }).getDataStream<tomcat.Domain.Base.CandleStickData>(pipeline.pipeline.candleStream.name)
        const candles = []
        // const pipe = runningServices[0].pipeline
        for await (const item of stream.reverse()) {
            if (candles.length > m.count) {
                break
            }
            candles.push(item)
        }
        await ctx.reply(candles)
        stream.dispose()
    })
    await node.start()

})();