import tomcat from "@gostarehnegar/tomcat";


tomcat.Infrastructure.Base.Logger.level = 'debug'
tomcat.config.infrastructure.data.redis.url = "redis://localhost:6379"
export class DataService implements tomcat.Infrastructure.Mesh.IMeshService {
    public exchange
    public symbol
    public market
    public interval
    public startTime
    public endTime
    public streamName;
    public status: tomcat.Infrastructure.Mesh.ServiceStatus = 'start'
    public Id: string = tomcat.utils.UUID()
    constructor(public def: tomcat.Infrastructure.Mesh.ServiceDefinition) {
        this.exchange = this.def.parameters["exchange"] as tomcat.Domain.Base.Exchanges
        this.symbol = this.def.parameters["symbol"] as tomcat.Domain.Base.Symbols
        this.market = this.def.parameters["market"] as tomcat.Domain.Base.Markets
        this.interval = this.def.parameters["interval"] as tomcat.Domain.Base.Intervals
        // this.startTime = tomcat.utils.toTimeEx(new Date(this.def.parameters["startTime"] as string))
        // this.startTime = typeof (this.def.parameters["startTime"]) == "string" ? tomcat.utils.toTimeEx(new Date(this.def.parameters["startTime"] as string)) : tomcat.utils.toTimeEx(this.def.parameters["startTime"]["ticks"])
        // this.endTime = this.def.parameters["endTime"] ?
        //     typeof (this.def.parameters["endTime"]) == "string" ?
        //         tomcat.utils.toTimeEx(new Date(this.def.parameters["endTime"] as string))
        //         : this.def.parameters["endTime"]["ticks"]
        //     : null
    }
    getInformation(): tomcat.Infrastructure.Mesh.ServiceInformation {
        return { category: 'data', parameters: { streamName: this.streamName, exchange: this.exchange, symbol: this.symbol, market: this.market, interval: this.interval, startTime: new Date(this.startTime).toISOString(), endTime: this.endTime ? new Date(this.endTime).toISOString() : null }, status: this.status }
    }
    start(): Promise<unknown> {
        const data = new tomcat.Domain.Exchange.CCXTDataStream(this.exchange, this.symbol, this.market, this.interval)
        const stream = new tomcat.Domain.Streams.DataSourceStreamEx(data);
        this.streamName = stream.name
        this.startTime = tomcat.utils.toTimeEx(Date.UTC(2021, 0, 1, 0, 0, 0, 0))
        stream.startEx(this.startTime
            //     ,(ctx)=>{
            //     if(ctx.err){
            //         console.error(ctx.err);
            //     }
            //     return false
            // }
        )
        return Promise.resolve()
    }
}

const dataServices: DataService[] = [];

(async () => {
    const client1 = tomcat.getHostBuilder('dataservice')
        .addMessageBus(cfg => {
            cfg.endpoint = "dataservice";
            cfg.transports.websocket.url
        })
        .addMeshService({ category: 'data' as tomcat.Infrastructure.Mesh.ServiceCategories, parameters: {} }, (def) => {
            let service = dataServices.find(x => tomcat.Infrastructure.Mesh.matchService(x.getInformation(), def))
            if (!service) {
                service = new DataService(def)
                dataServices.push(service)
            }
            return service
        })
        .build();

    client1.bus.subscribe(tomcat.Domain.Contracts.queryDataStreamName(null).topic, async (ctx) => {
        const meshNode = client1.services.getService<tomcat.Infrastructure.Mesh.MeshNode>(tomcat.constants.Infrastructure.ServiceNames.MeshNode)
        const payload = ctx.message.cast<tomcat.Domain.Contracts.queryDataStreamNamePayload>()
        const service = (meshNode.runningServices as DataService[]).find(x => x.exchange == payload.exchange && x.symbol == payload.symbol && x.interval == payload.interval && x.market == payload.market)
        if (service) {
            await ctx.reply({ connectionString: tomcat.config.infrastructure.data.redis.url + `/${service.streamName}` })
        } else {
            await ctx.reply({ err: "no streams found" })
        }
    })

    await client1.start()
    await tomcat.utils.delay(15000);

})()