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
    const isInteractiveEvent = eventType => eventType && (
        eventType.startsWith("mouse") ||
        eventType.startsWith("touch") ||
        ["click", "dblclick", "contextmenu"].includes(eventType)
    );

    /**
     * @exports mapboxgl-Map
     */
    const Map = mapboxgl.Map;
    const originalMapOnFunc = Map.prototype.on;
    const originalMapOffFunc = Map.prototype.off;
    const originalMapFireFunc = Map.prototype.fire;

    /**
     * Add a listener to the map concerning the layer `layerId`.
     * The listener should test whether the specific event is for the layer or not.
     *
     * Events will be fired from top to bottom (following pseudo-z-index)
     * and only if the [`originalEvent.cancelBubble` is falsy](https://developer.mozilla.org/en-US/docs/Web/API/Event/cancelBubble).
     * @param   {string}   layerId   the layer id.
     * @param   {string}   eventType the event type.
     * @param   {function} listener  the listener which will be called with a mapbox event.
     * @returns {function} a wrapped listener, original listener could be found in the `originalListener` property.
     */
    Map.prototype.addListenerForLayer = function (layerId, eventType, listener) {
        this._layersEvented = this._layersEvented || [];
        let evented = this._layersEvented[layerId] = this._layersEvented[layerId] || new mapboxgl.Evented();
        let wrappedListener = function (event) {
            (!event.originalEvent.bubbles || !event.originalEvent.cancelBubble) && listener.call(this, event);
        };
        wrappedListener.originalListener = listener;
        evented.on(eventType, wrappedListener);
        return wrappedListener;
    };

    /**
     * Get all (wrapped) listeners for the specified layer id.
     * @param   {string} layerId the layer id
     * @returns {object} object with all listeners as property.
     *
     * `Evented._listeners` or empty object.
     * @see [`Evented` on *mapboxgl*](https://www.mapbox.com/mapbox-gl-js/api/#evented).
     */
    Map.prototype.getListenersForLayer = function (layerId) {
        let layersEvented = this._layersEvented || [];
        let evented = layersEvented[layerId] || null;
        return evented && evented._listeners || {};
    };

    /**
     * Remove a listener from a layer.
     * The listener could be a real or a wrapper listener.
     * @param   {string}   layerId   the layer id corresponding to the listener.
     * @param   {string}   eventType the event type.
     * @param   {function} listener  the listener to remove.
     */
    Map.prototype.removeListenerFromLayer = function (layerId, eventType, listener) {
        let evented = this._getLayerEventedForLayer(layerId) || null;
        let listeners = evented && evented._listeners && evented._listeners[eventType] || [];
        let wrappedListener = listeners.find(l => l === listener || l.originalListener === listener);
        if (wrappedListener) {
            evented.off(eventType, wrappedListener);
        }
    };

    Map.prototype._getLayerEventedForLayer = function (layerId) {
        return this._layersEvented && this._layersEvented[layerId];
    };

    Map.prototype._getLayersEventedByZIndexFor = function (type) {
        let layersEvented = [];
        let layersId = this.style && this.style._order && this.style._order.slice().reverse() || [];
        for (let layerId of layersId) {
            let layerEvented = this._getLayerEventedForLayer(layerId);
            if (layerEvented && layerEvented.listens(type)) {
                layersEvented.push(layerEvented);
            }
        }
        return layersEvented;
    };

    /**
     * Enhance `on` method for registering an event.
     *
     * The following special map event `type` could be registerd:
     * - *mousedown*
     * - *mouseup*
     * - *click*
     * - *dblclick*
     * - *mousemove*
     * - *mouseenter* / *mouseover*: the cursor enters a visible portion of the specified layer from outside that layer or outside the map canvas.
     * - *mouseleave*: the cursor leaves a visible portion of the specified layer or leaves the map canvas.
     * - *mouseout*: the cursor leaves the map canvas.
     * - *contextmenu*
     * - *touchstart*
     * - *touchend*
     * - *touchcancel*
     *
     * Events will be fired from **top** to **bottom** (following the [*bubble effect*](https://developer.mozilla.org/en-US/docs/Web/API/Event/bubbles))
     * and only if the `originalEvent` can propagate (`bubbles` getter is falsy or `stopPropagation` has not been called on it).
     * @param   {string}          type                     one of the available types.
     * @param   {string|function} [layerIdOrListener=null] A style layer id if you want to restrict events to the visible features of a layer.
     *
     * Otherwise, a listener which takes a mapboxgl event as argument.
     *
     * The event object has three more properties:
     * - `originalEvent`: the DOM event
     * - `target`: the DOM target
     * - `type`: the event type
     * @param   {function}        [layerListener=null]     The listener if not defined in the previous parameter.
     * @returns {Map} this
     */
    Map.prototype.on = function (type, layerIdOrListener = null, layerListener = null) {
        let layerId = layerListener == null ? null : layerIdOrListener;
        let listener = layerListener == null ? layerIdOrListener : layerListener;
        if (isInteractiveEvent(type) && layerId) {
            let layer = this.getLayer(layerId);
            layer.metadata = layer.metadata || {};
            listener.delegates = [];
            if (type === "mouseenter" || type === "mouseover") {
                let mousemove = (e) => {
                    const layer = this.getLayer(layerId);
                    const features = layer ? this.queryRenderedFeatures(e.point, { layers: [layerId] }) : [];
                    if (!features.length) {
                        layer.metadata["mouseenter:mousein"] = false;
                    } else if (!layer.metadata["mouseenter:mousein"]) {
                        layer.metadata["mouseenter:mousein"] = true;
                        listener.call(this, Object.assign({ features, type }, e));
                    }
                };
                mousemove.event = "mousemove";
                let mouseout = () => {
                    this.getLayer(layerId).metadata["mouseenter:mousein"] = false;
                };
                mouseout.event = "mouseout";
                listener.delegates.push(mousemove);
                listener.delegates.push(mouseout);
            } else if (type === "mouseleave" || type === "mouseout") {
                let mousemove = (e) => {
                    const layer = this.getLayer(layerId);
                    const features = layer ? this.queryRenderedFeatures(e.point, { layers: [layerId] }) : [];
                    if (features.length) {
                        layer.metadata["mouseleave:mousein"] = true;
                    } else if (layer.metadata["mouseleave:mousein"]) {
                        layer.metadata["mouseleave:mousein"] = false;
                        listener.call(this, Object.assign({ type }, e));
                    }
                };
                mousemove.event = "mousemove";
                let mouseout = (e) => {
                    if (layer.metadata["mouseleave:mousein"]) {
                        layer.metadata["mouseleave:mousein"] = false;
                        listener.call(this, Object.assign({ type }, e));
                    }
                };
                mouseout.event = "mouseout";
                listener.delegates.push(mousemove);
                listener.delegates.push(mouseout);
            } else {
                let delegate = (e) => {
                    const features = this.getLayer(layerId) ? this.queryRenderedFeatures(e.point, { layers: [layerId] }) : [];
                    if (features.length) {
                        listener.call(this, Object.assign({ features }, e));
                    }
                };
                delegate.event = type;
                listener.delegates.push(delegate);
            }
            for (let delegate of listener.delegates) {
                this.addListenerForLayer(layerId, delegate.event, delegate);
            }
            return this;
        } else {
            return originalMapOnFunc.call(this, type, listener);
        }
    };

    /**
     * Removes an event listener (eventually for layer-specific events) previously added with [on method](#on).
     * @param   {string}          type                     one of the available types.
     * @param   {string|function} [layerIdOrListener=null] A style layer id from which you want to remove the listener.
     *
     * Otherwise, the listener to remove.
     * @param   {function}        [layerListener=null]     The listener to remove if not defined in the previous parameter.
     * @returns {Map} this
     */
    Map.prototype.off = function (type, layerIdOrListener = null, layerListener = null) {
        let layerId = layerListener == null ? null : layerIdOrListener;
        let listener = layerListener == null ? layerIdOrListener : layerListener;
        if (isInteractiveEvent(type) && layerId) {
            if (listener.delegates) {
                for (let delegate of listener.delegates) {
                    this.removeListenerFromLayer(layerId, delegate.event, delegate);
                }
            } else {
                this.removeListenerFromLayer(layerId, type, listener);
            }
            return this;
        } else {
            return originalMapOffFunc.call(this, type, listener);
        }
    };

    /**
     * Fires an event of the specified type.
     *
     * Respect the *bubble effect*.
     * @param   {string} type  one of the available types.
     * @param   {object} event event data
     * @returns {Map} this
     * @see [`on` method](#on).
     * @see [`Evented` on *mapboxgl*](https://www.mapbox.com/mapbox-gl-js/api/#evented).
     */
    Map.prototype.fire = function (type, event) {
        if (isInteractiveEvent(type)) {
            for (let layerEvented of this._getLayersEventedByZIndexFor(type)) {
                layerEvented.fire(type, event);
            }
            if (event.originalEvent && event.originalEvent.cancelBubble) {
                return this;
            } else {
                return originalMapFireFunc.call(this, type, event);
            }
        } else {
            return originalMapFireFunc.call(this, type, event);
        }
    };

    return mapboxgl;
}));
