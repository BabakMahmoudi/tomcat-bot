
import tomcat from '@gostarehnegar/tomcat'

import { Wallet } from './wallet'
const STRATEGYSTREAM = "strategy-BT-01"
const WALLETSTREAM = "wallet-BT-01"
// const DATASTREAM = "data-BT-01"
const INDICATORSTREAM = "indicators-BT-01"
const indicators = tomcat.Domain.Indicators
type IIndicator = tomcat.Domain.Indicators.IIndicator
type CandleStickData = tomcat.Domain.Base.CandleStickData
type IFilter = tomcat.Domain.Pipes.IFilter
type Signal = tomcat.Domain.Base.Signal
type Signals = tomcat.Domain.Base.Signals
type Stream<T> = tomcat.Domain.Streams.Stream<T>
const isSarAbove: IIndicator = {

    id: "isSARAbove",
    handler: async (candle: CandleStickData) => {
        const median = (candle.high + candle.low) / 2;
        if (
            candle.indicators &&
            candle.indicators.has(indicators.SAR()) &&
            candle.indicators.getNumberValue(indicators.SAR()) < median
        ) {
            candle.indicators.setValue(isSarAbove, false)
        } else if (
            candle.indicators &&
            candle.indicators.has(indicators.SAR()) &&
            candle.indicators.getValue(indicators.SAR()) > median
        ) {
            candle.indicators.setValue(isSarAbove, true)
        }

    },
};

const stopLossAtr: IIndicator = {
    id: "stopLossAtr",
    handler: async (candle: CandleStickData) => {
        if (candle.indicators && candle.indicators.has(indicators.ATR())) {
            candle.indicators.setValue(stopLossAtr, 1.25 * candle.indicators.getNumberValue(indicators.ATR()))
        }
    },
};

const adxSlope: IIndicator = {
    id: "adxSlope",
    handler: async (candle: CandleStickData, THIS: IFilter) => {
        const candles = THIS.getScaler('4h').push(candle)
        const previousCandle = candles.length > 1 ? candles.items[candles.length - 2] : null
        if (previousCandle &&
            candle.indicators &&
            candle.indicators.has(indicators.ADX()) &&
            previousCandle.indicators &&
            previousCandle.indicators.has(indicators.ADX())
        ) {
            const res = ((candle.indicators.getNumberValue(indicators.ADX()) - previousCandle.indicators.getNumberValue(indicators.ADX())) / previousCandle.indicators.getNumberValue(indicators.ADX())) * 100
            candle.indicators.setValue(adxSlope, res)
        }
    },
};


export class Strategy {
    name: string
    candle: CandleStickData
}

const requireDataStream = async (bus: tomcat.Infrastructure.Bus.IMessageBus, exchange, interval, market, symbol) => {
    const service = new tomcat.Domain.Contracts.DataServiceDefinition({ exchange: exchange, interval: interval, market: market, symbol: symbol})
    let status: tomcat.Infrastructure.Mesh.ServiceStatus = "stop"
    while (status !== 'start') {
        try {

            const res: tomcat.Infrastructure.Mesh.ServiceInformation = (await bus.createMessage(tomcat.Infrastructure.Contracts.requireService(service)).execute())
                ?.cast<tomcat.Infrastructure.Mesh.ServiceInformation>()
            status = res?.status
        } catch (err) {
            console.error(err);
        }
    }
    return status
}

const queryStreamName = async (bus: tomcat.Infrastructure.Bus.IMessageBus, exchange, interval, market, symbol, startTime) => {
    const result = await bus.createMessage(tomcat.Domain.Contracts.queryDataStreamName({ exchange: exchange, interval: interval, market: market, symbol: symbol, startTime: startTime })).execute()
    return result;
}

const requireRedisStream = async (bus: tomcat.Infrastructure.Bus.IMessageBus) => {
    const res = await bus.createMessage(tomcat.Infrastructure.Contracts.serviceOrder({ category: 'redis', parameters: {} })).execute()
    return res
}
const queryRedisConnectionString = async (bus: tomcat.Infrastructure.Bus.IMessageBus, containerName) => {
    return await bus.createMessage(tomcat.Domain.Contracts.queryRedisContainer({ containerName: containerName })).execute()
}

export class ArshiaBot implements tomcat.Infrastructure.Mesh.IMeshService {
    public wallet: Wallet
    public interval
    public exchange
    public market
    public symbol
    public startTime;
    public endTime;
    public dataStream;
    public redisContainer
    public status: tomcat.Infrastructure.Mesh.ServiceStatus = 'start'
    constructor(public def: tomcat.Infrastructure.Mesh.ServiceDefinition, public serviceProvider: tomcat.Infrastructure.Base.IServiceProvider) {
        this.wallet = new Wallet(1000, null, 'BTCUSDT', WALLETSTREAM)
        this.exchange = this.def.parameters['exchange'] || "binance"
        this.interval = this.def.parameters["interval"] || "1m"
        this.market = this.def.parameters["market"] || "spot"
        this.symbol = this.def.parameters["symbol"] || "BTCUSDT"
        this.startTime = tomcat.utils.toTimeEx(new Date(this.def.parameters.startTime as string))
        this.endTime = tomcat.utils.toTimeEx(new Date(this.def.parameters.endTime as string))
    }
    getInformation(): tomcat.Infrastructure.Mesh.ServiceInformation {
        return { category: 'strategy', parameters: { startTime: this.startTime, endTime: this.endTime }, status: this.status }
    }
    strategy(candle: CandleStickData): Signal {

        const indicator = candle.indicators
        let result: Signals = ''
        let reason = ''
        if (
            candle && !candle.isMissing &&
            indicator &&
            indicator.has(indicators.PDI(), indicators.MDI(), adxSlope, isSarAbove)
        ) {
            if (
                indicator.getBoolValue(isSarAbove) == false &&
                indicator.getNumberValue(indicators.PDI()) > (indicator.getNumberValue(indicators.MDI()) + 5) &&
                indicator.getValue(adxSlope) > 1
            ) {
                result = "openLong"
            } else if (
                indicator.getBoolValue(isSarAbove) == true &&
                indicator.getNumberValue(indicators.PDI()) < (indicator.getNumberValue(indicators.MDI()) - 5) &&
                indicator.getNumberValue(adxSlope) > 1
            ) {
                result = 'openShort'
            }
            else if (
                indicator.getBoolValue(isSarAbove) == true ||
                indicator.getNumberValue(indicators.PDI()) < (indicator.getNumberValue(indicators.MDI()) - 5) ||
                // > -5
                indicator.getNumberValue(adxSlope) < -5
            ) {
                result = 'closeLong'
                reason = indicator.getBoolValue(isSarAbove) == true
                    ? 'sarAbove' :
                    indicator.getNumberValue(indicators.PDI()) < (indicator.getNumberValue(indicators.MDI()) - 5)
                        ? 'plusDi in greater than minusDi' :
                        indicator.getNumberValue(adxSlope) < -5
                            ? 'adxSlope less than -5' :
                            ''
            }
            else if (
                indicator.getBoolValue(isSarAbove) == false ||
                indicator.getNumberValue(indicators.PDI()) > (indicator.getNumberValue(indicators.MDI()) + 5) ||
                // > -5
                indicator.getNumberValue(adxSlope) < -5
            ) {
                result = 'closeShort'
                reason = indicator.getBoolValue(isSarAbove) == false
                    ? 'sarBelow'
                    : indicator.getNumberValue(indicators.PDI()) > (indicator.getNumberValue(indicators.MDI()) + 5)
                        ? "plusDi in greater than minusDi"
                        : indicator.getNumberValue(adxSlope) < -5
                            ? 'adxSlope is less than -5'
                            : ''
            }
        }
        const signal = new tomcat.Domain.Base.Signal(result, candle, candle.indicators.getNumberValue(indicators.ATR()))
        signal.reason = reason
        return signal
    }
    async start(): Promise<unknown> {
        let isStreamAvailable;
        let connectionString;
        await requireDataStream(this.serviceProvider.getBus(), this.exchange, this.interval, this.market, this.symbol);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isRedis: any = await requireRedisStream(this.serviceProvider.getBus());
        while (!isStreamAvailable && !connectionString) {
            try {
                connectionString = await queryRedisConnectionString(this.serviceProvider.getBus(), isRedis.payload.parameters["redisName"])
                isStreamAvailable = await queryStreamName(this.serviceProvider.getBus(), this.exchange, this.interval, this.market, this.symbol, this.startTime)
            } catch (err) {
                console.error(err);
            }
        }
        this.dataStream = isStreamAvailable.payload["connectionString"]
        this.redisContainer = connectionString.payload["connectionString"]
        const pipeline = new tomcat.Domain.Pipes.Pipeline()
        pipeline.fromStream(this.dataStream)
            .add(indicators.ADX())
            .add(indicators.MDI())
            .add(indicators.ATR())
            .add(indicators.SAR())
            .add(indicators.PDI())
            .add(isSarAbove)
            .add(adxSlope)
            .add(stopLossAtr, { stream: true, name: INDICATORSTREAM })
            .add(async (candle, THIS) => {
                THIS.context.stream = THIS.context.stream || new tomcat.Domain.Streams.Stream<Strategy>(STRATEGYSTREAM, this.redisContainer)
                const stream = THIS.context.stream as Stream<Strategy>
                const res = await this.strategy(candle)
                await stream.write(tomcat.utils.toTimeEx(candle.openTime), { name: res.signal, candle: candle })
                if (res.signal && candle.openTime >= tomcat.utils.toTimeEx(Date.UTC(2020, 0, 1, 0, 0, 0, 0)).ticks) {
                    await this.wallet.onSignal(res)
                }
            })
        pipeline.startEx(this.startTime)
        return Promise.resolve()
    }

}
