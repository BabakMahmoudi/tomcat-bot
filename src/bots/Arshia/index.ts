import tomcat from '@gostarehnegar/tomcat'

import { Wallet } from './wallet'
const STRATEGYSTREAM = "strategy-BT-01"
const WALLETSTREAM = "wallet-BT-01"
const DATASTREAM = "data-BT-01"
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



const strategy = (candle: CandleStickData): Signal => {

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
export class Strategy {
    name: string
    candle: CandleStickData
}

export class Bot {
    public wallet: Wallet
    constructor() {
        this.wallet = new Wallet(1000, null, 'BTCUSDT', WALLETSTREAM)
    }
    public get indicators() {
        return { ADX: indicators.ADX(), ATR: indicators.ATR(), SAR: indicators.SAR(), minusDi: indicators.MDI(), plusDi: indicators.PDI(), isSarAbove: isSarAbove, adxSlope: adxSlope, stopLossAtr: stopLossAtr }
    }
    run(startTime: tomcat.Infrastructure.Base.Ticks, endTime: tomcat.Infrastructure.Base.Ticks) {
        (endTime);
        const pipeline = new tomcat.Domain.Pipes.Pipeline()
        // const time = 1633174260000

        pipeline.from('binance', 'spot', 'BTCUSDT', '1m', DATASTREAM)
            .add(this.indicators.ADX)
            .add(this.indicators.minusDi)
            .add(this.indicators.ATR)
            .add(this.indicators.SAR)
            .add(this.indicators.plusDi)
            .add(isSarAbove)
            .add(adxSlope)
            .add(stopLossAtr, { stream: true, name: INDICATORSTREAM })
            .add(async (candle, THIS) => {

                THIS.context.stream = THIS.context.stream || new tomcat.Domain.Streams.Stream<Strategy>(STRATEGYSTREAM)

                const stream = THIS.context.stream as Stream<Strategy>
                const res = await strategy(candle)
                await stream.write(tomcat.utils.toTimeEx(candle.openTime), { name: res.signal, candle: candle })
                if (res.signal && candle.openTime >= tomcat.utils.toTimeEx(Date.UTC(2020, 0, 1, 0, 0, 0, 0)).ticks) {
                    await this.wallet.onSignal(res)
                }
            })
            .add(async (candle) => {
                // await tomcat.utils.delay(5000)
                if (candle.openTime == endTime) {
                    pipeline.stop()
                }
            })
        pipeline.startEx(startTime)
    }
}

const startTime = tomcat.utils.toTimeEx(Date.UTC(2020, 0, 1, 0, 0, 0, 0)).addMinutes(-30 * 1440)
const endTime = tomcat.utils.toTimeEx(Date.UTC(2021, 0, 1, 0, 0, 0, 0));
const bot = new Bot()
bot.run(startTime, endTime)



const CandleStream = tomcat.Domain.Streams.CandleStream
const PORT = 8000;
const app = tomcat
    .getHostBuilder("bot")
    .buildWebHost('express')
    .expressApp;
const strategyStream = new CandleStream(STRATEGYSTREAM)
const walletStream = new CandleStream(WALLETSTREAM)



app.get("/query", async (req, res) => {
    const timquery = req.query["startTime"] as string
    const time = timquery.indexOf('Z') > 0 ?
        tomcat.utils.toTimeEx(new Date(timquery))
        : tomcat.utils.toTimeEx(Number(req.query["startTime"])).floorToMinutes(1)
    const result = await strategyStream.getCandle(time)
    // const candle = JSON.parse(result.candle)
    res.json(result)

})
app.get("/trades", async (req, res) => {
    (req);
    const trades = []
    const result = await walletStream.getAll();
    if (result && result.length > 0) {
        for (let i = 0; i < result.length; i++) {
            const a = JSON.parse(result[i])
            a["id"] = i
            trades.push(a)
        }
    }
    res.json(trades)
})
app.listen(PORT, () => {
    console.log(`tomcat listening on port ${PORT} ...`);
});



