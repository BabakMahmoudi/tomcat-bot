import tomcat from '@gostarehnegar/tomcat'

import { ArshiaBot } from './ArshiaBot';

tomcat.Infrastructure.Base.Logger.level = "debug";

(async () => {

    const host = tomcat.getHostBuilder("arshia")
        .addMessageBus(cfg => {
            cfg.endpoint = "arshia"
            cfg.transports.websocket.url = "http://localhost:8084/hub"
        })
        .addMeshService({ category: 'strategy', parameters: {} }, (def) => {
            (def);//check def and deside on rejecting
            return new ArshiaBot(def, host.services)
        })
        .build()
    host.start()
    await tomcat.utils.delay(5000)
    

})()