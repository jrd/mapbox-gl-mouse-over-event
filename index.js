/**
 * Mapbox GL Mouse over event fix plugin
 * @module mapboxgl
 * @author Cyrille Pontvieux <cyrille@enialis.net>
 * @returns mapboxgl instance with an enhanced [Map](module-mapboxgl-Map.html)
 */

(function (root, factory) {
    // https://github.com/umdjs/umd/blob/master/templates/returnExports.js
    if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define(["mapbox-gl"], factory);
    } else if (typeof module === "object" && module.exports) {
        // Node. Does not work with strict CommonJS, but only CommonJS-like environments that support module.exports, like Node.
        module.exports = factory(require("mapbox-gl"));
    } else {
        // Browser globals (root is window)
        root.mapboxgl = factory(root.mapboxgl);
    }
}(typeof self !== "undefined" ? self : this, function (mapboxgl) {
    let addFeatureOnEvent = e => {
        if (e.features && e.features.length) {
            e.feature = e.features[0];
        }
    };

    /**
     * @exports mapboxgl-Map
     */
    const GLMap = mapboxgl.Map;

    /**
     * Create a mouse over effect on a layer by using callbacks.
     *
     * `callback` functions is the same as for `on` map method.
     * Each *callback* is **optional**.
     *
     * Each *callback* `event` have a new attribute **`feature`** which is just a shorthand for `features[0]`.
     * @alias module:mapboxgl-Map#onMouseOver
     * @param {string} layerName name of the layer
     * @param {callback} enterCallback callback method when entering a feature on the layer
     * @param {callback} exitCallback callback method when leaving feature on the layer
     * @param {callback} moveOnCallback callback method when moving on a feature on the layer
     */
    GLMap.prototype.onMouseOver = function (layerName, enterCallback = () => {}, exitCallback = () => {}, moveOnCallback = () => {}) {
        let lastFeatureId = null;
        this.on("mousemove", layerName, e => {
            if (!e.originalEvent.cancelBubble) {
                addFeatureOnEvent(e);
                let featureOnMap = this.queryRenderedFeatures(e.point)[0];
                let featureOnLayer = e.feature;
                if (featureOnMap.id == featureOnLayer.id) {
                    if (featureOnLayer.id != lastFeatureId) {
                        lastFeatureId = featureOnLayer.id;
                        enterCallback(e);
                    } else {
                        moveOnCallback(e);
                    }
                    e.originalEvent.stopPropagation();
                }
            }
        });
        this.on("mouseleave", layerName, e => {
            if (!e.originalEvent.cancelBubble) {
                let featuresOnLayer = this.queryRenderedFeatures(e.point, { layers: [layerName] });
                if (featuresOnLayer.length == 0) {
                    lastFeatureId = null;
                    exitCallback(e);
                }
            }
        });
    };

    /**
     * Create a click event on a layer.
     *
     * `callback` functions is the same as for `on` map method.
     *
     * *Callback* is **optional** and have a new attribute **`feature`** which is just a shorthand for `features[0]`.
     *
     * The click event can only occurs on the layer with a feature with the greatest z-index.
     * @alias module:mapboxgl-Map#onClick
     * @param {string} layerName name of the layer
     * @param {callback} callback callback method when a click happened on a feature on the layer
     */
    GLMap.prototype.onClick = function (layerName, callback = () => {}) {
        this.on("click", layerName, e => {
            if (!e.originalEvent.cancelBubble) {
                addFeatureOnEvent(e);
                let featureOnMap = this.queryRenderedFeatures(e.point)[0];
                let featureOnLayer = e.feature;
                if (featureOnMap.id == featureOnLayer.id) {
                    callback(e);
                    e.originalEvent.stopPropagation();
                }
            }
        });
    };
    return mapboxgl;
}));
