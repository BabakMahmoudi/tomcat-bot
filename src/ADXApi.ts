import tomcat from "@gostarehnegar/tomcat";
import { ApiServiceNode } from "@gostarehnegar/tomcat/build/main/pipes";

import { ADX } from "./indicators";

const ADXParams = {
    interval: '*',
    period: '*',
    maxCount: '*'
};
(async () => {

    const node = tomcat.getHostBuilder("adx").addHostedService(s => new ApiServiceNode(s,
        [{
            name: "ADX", params: ADXParams, handler: async x => {
                ADX(x.data.params["period"], x.data.params["maxCount"], x.data.params["interval"]).handler(x)
                return x
            }
        }])).buildWebHost('express')
    node.listen(3004)

    const nodeClient = tomcat.getHostBuilder("nodeClient").addHostedService(s => new ApiServiceNode(s, [], 'http://localhost:3004')).buildWebHost('express')
    nodeClient.listen(3005)
    const api = nodeClient.services.getService<ApiServiceNode>("ApiServiceNode")
    await tomcat.utils.delay(3000)
    const res = await api.call('ADX', {})
    res.candle.indicators.getNumberValue(ADX().id)
    console.log(res);

})()