import tomcat from '@gostarehnegar/tomcat'

export class Trade {
    constructor(symbol: tomcat.Domain.Base.Symbols, side: tomcat.Domain.Base.Sides, price: number, quantity: number, time: number, public reason?: string) {
        this.time = time
        this.symbol = symbol
        this.side = side
        this.price = price
        this.quantity = quantity
    }
    public time;
    public symbol: tomcat.Domain.Base.Symbols;
    public side: tomcat.Domain.Base.Sides;
    public price;
    public quantity;
    public fee;
    public realizedProfit;
    public balance: number
    recalculate(prevTrade: Trade) {
        if (prevTrade == null) {
            this.realizedProfit = 0
            return null
        }
        if (this.side == 'buy') {
            this.realizedProfit = ((this.price - prevTrade.price) * this.quantity) * -1
        } else if (this.side == 'sell') {
            this.realizedProfit = (this.price - prevTrade.price) * this.quantity
        }
    }
    public static createFromOrder(order: Order) {
        return new Trade(order.symbol, order.side, order.price, order.amount, order.time, order.reason)
    }
}
export class Order {
    constructor(symbol: tomcat.Domain.Base.Symbols, side: tomcat.Domain.Base.Sides, price: number, amount: number, time: tomcat.Infrastructure.Base.Ticks, public reason?: string) {
        this.time = time
        this.symbol = symbol
        this.side = side
        this.price = price
        this.amount = amount
    }
    public time;
    public symbol: tomcat.Domain.Base.Symbols;
    /**
     * market , limit, take profit.
     */
    public type;
    /**
     * buy or sell
     */
    public side: tomcat.Domain.Base.Sides;
    /**
     * ?
     */
    public average;
    /**
     * close price of candle
     */
    public price;
    /**
     * in BTC
     */
    public executed;
    /**
     * actual BTC
     */
    public amount;
}

export class Wallet {
    public leverage: number;
    public logger = tomcat.utils.getLogger("Wallet")
    public tradeList: Trade[] = []
    public stream: tomcat.Domain.Streams.Stream<Trade>
    public state: tomcat.Domain.Base.States
    public stopLoss: number
    constructor(public balance: number, public bus: tomcat.Infrastructure.Bus.IMessageBus, public symbol: tomcat.Domain.Base.Symbols, streamName?) {
        this.stream = streamName || new tomcat.Domain.Streams.Stream<Trade>("wallet-BT-01")
        this.state = 'open'
    }
    processOrder(order: Order) {
        // await utils.delay(100)
        if (order == null) {
            throw "order cannot be null"
        }
        const trade = Trade.createFromOrder(order)
        this.addTrade(trade)
    }
    onSignal(signal: tomcat.Domain.Base.Signal) {
        const candle = signal.candle
        if (this.state == 'openLong' && this.stopLoss > candle.close) {
            signal.signal = 'closeLong'
            signal.reason = 'stopLoss'
            console.log(`closeLong stopLoss Happened  stopOn: ${this.stopLoss} price:${candle.close} `);
        }
        else if (this.state == 'openShort' && this.stopLoss < candle.close) {
            signal.signal = 'closeShort'
            signal.reason = 'stopLoss'
            console.log(`closeShort stopLoss Happened  stopOn: ${this.stopLoss} price:${candle.close} `);
        }
        switch (signal.signal) {
            case "openShort":
                this.openShort(signal)
                break;
            case "openLong":
                this.openLong(signal)
                break;
            case "closeShort":
                this.closeShort(signal)
                break;
            case "closeLong":
                this.closeLong(signal)
                break;
            default:
                console.log("signal was not handled");
                break;
        }
    }
    addTrade(trade: Trade) {
        const latestTrade = this.getLatestOpenTrade()
        const isValid = latestTrade == null || latestTrade.side != trade.side
        if (isValid) {
            trade.recalculate(latestTrade)
            this.balance += trade.realizedProfit
            trade.balance = this.balance
            this.tradeList.push(trade)
            this.stream.write(tomcat.utils.toTimeEx(trade.time), trade)
            const date = new Date(trade.time)
            const count = this.tradeList.length
            const formattedDate = `${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${date.getUTCDate()},${date.getUTCHours()}:${date.getUTCMinutes()}`
            this.logger.info(`\n${count}\t${formattedDate}\t${trade.side}\t${trade.quantity}\t${trade.price}\t\t${trade.realizedProfit}\t${this.balance}`);
        } else {
            console.log('mano nabayad bebini')
        }
        return trade

    }
    getLatestOpenTrade() {
        if (this.tradeList.length % 2 == 0) {
            return null
        } else {
            return this.tradeList[this.tradeList.length - 1]
        }
    }
    getCoinBalance() {
        const latestOpen = this.getLatestOpenTrade()
        if (latestOpen) {
            return latestOpen.quantity
        } else {
            return 0
        }
    }
    setLeverage(leverage: number) {
        this.leverage = leverage
    }
    getMargin() {
        const latestTarde = this.getLatestOpenTrade()
        if (latestTarde) {
            return (latestTarde.quantity * latestTarde.price) / this.leverage
        }
        return 0
    }
    toString() {
        return `current balance is ${this.balance} , current coin balance is ${this.getCoinBalance()}\n last position is ${this.getLatestOpenTrade()?.quantity} ${this.getLatestOpenTrade()?.side}`
    }
    openLong(signal: tomcat.Domain.Base.Signal) {
        if (this.state == 'open') {
            const price = signal.candle.close
            const amount = ((0.03 * this.balance) * signal.stopLoss / signal.candle.close)
            this.stopLoss = price - signal.stopLoss
            this.leverage = signal.stopLoss
            const orderEX = new Order(this.symbol, 'buy', price, amount, signal.candle.closeTime, signal.reason)
            this.state = 'openLong'
            this.processOrder(orderEX)
        }
        else if (this.state == 'openShort') {
            this.closeShort(signal)
            this.state = 'open'
        }
    }
    openShort(signal: tomcat.Domain.Base.Signal) {
        const candle = signal.candle
        if (this.state == 'open') {
            const price = candle.close
            const amount = ((0.03 * this.balance) * signal.stopLoss) / candle.close
            this.stopLoss = price + signal.stopLoss
            this.leverage = signal.stopLoss
            const orderEX = new Order(this.symbol, 'sell', price, amount, candle.closeTime, signal.reason)
            this.state = 'openShort'
            this.processOrder(orderEX)
        }
        else if (this.state == 'openLong') {
            this.closeLong(signal)
            this.state = 'open'
        }
    }
    closeLong(signal: tomcat.Domain.Base.Signal) {
        const candle = signal.candle
        if (this.state == 'openLong') {
            const price = candle.close
            const latestTrade = this.getLatestOpenTrade()
            const amount = latestTrade.quantity
            const orderEX = new Order(this.symbol, 'sell', price, amount, candle.closeTime, signal.reason)
            this.state = 'open'
            this.processOrder(orderEX)
        }
    }
    closeShort(signal: tomcat.Domain.Base.Signal) {
        const candle = signal.candle
        if (this.state == 'openShort') {
            const price = candle.close
            const latestTrade = this.getLatestOpenTrade()
            const amount = latestTrade.quantity
            const orderEX = new Order(this.symbol, 'buy', price, amount, candle.closeTime, signal.reason)
            this.state = 'open'
            this.processOrder(orderEX)
        }
    }
}
