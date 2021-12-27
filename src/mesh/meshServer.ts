import tomcat from '@gostarehnegar/tomcat'


(async () => {

    const port = 8081;
    const hub = tomcat.getHostBuilder('hub')
        .addWebSocketHub()
        .buildWebHost();
    const server = tomcat.getHostBuilder('server')
        .addMessageBus(cfg => {
            cfg.endpoint = 'server'
            cfg.transports.websocket.url = `http://localhost:${port}/hub`;
        })
        .addMeshServer()
        .buildWebHost();

    await hub.listen(port);
    await server.start();
})();