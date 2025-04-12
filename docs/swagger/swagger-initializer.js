window.onload = function() {
  //<editor-fold desc="Changeable Configuration Block">

  const HideInfoUrlPartsPlugin = () => {
    return {
      wrapComponents: {
        InfoUrl: () => () => null
      }
    }
  }

  // the following lines will be replaced by docker/configurator, when it runs in a docker-container
  window.ui = SwaggerUIBundle({
    url: "../openapi.json",
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      HideInfoUrlPartsPlugin,
      //SwaggerUIBundle.plugins.DownloadUrl,
    ],
    //layout: "StandaloneLayout"
  });

  //</editor-fold>
};
