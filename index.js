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

    ////////////////////////////////////////////////////////////
    /**
     * Following code is copied from MapboxGL because it's not publicly availlable in the library.
     */

    /**
     * Event class, copied from https://github.com/mapbox/mapbox-gl-js/blob/v0.45.0/src/util/evented.js#L22 because it's extended by MapMouseEvent.
     * @param {String} type
     * @param {Object} data
     */
    const Event = function Event(type, data) {
        if (data === undefined) {
            data = {};
        }
        extend(this, data);
        this.type = type;
    };

    /**
     * Code copied from : https://github.com/mapbox/mapbox-gl-js/blob/v0.45.0/src/util/dom.js#L104
     */
    const DOM = {};
    DOM.mousePos = function (el, e) {
        const rect = el.getBoundingClientRect();
        e = e.touches ? e.touches[0] : e;
        return new mapboxgl.Point(
            e.clientX - rect.left - el.clientLeft,
            e.clientY - rect.top - el.clientTop
        );
    };

    /**
     * Given a destination object and optionally many source objects,
     * copy all properties from the source objects into the destination.
     * The last source object given overrides properties from previous
     * source objects.
     *
     * Code copied from : https://github.com/mapbox/mapbox-gl-js/blob/v0.45.0/src/util/util.js#L152
     *
     * @param {Object} dest destination object
     * @returns {Object} dest
     * @private
     */
    const extend = function (dest) {
        const sources = [];
        let len = arguments.length - 1;
        while (len-- > 0) {
            sources[len] = arguments[len + 1];
        }
        for (let i = 0, list = sources; i < list.length; i += 1) {
            const src = list[i];
            for (const k in src) {
                dest[k] = src[k];
            }
        }
        return dest;
    };

    /**
     * `MapMouseEvent` is the event type for mouse-related map events.
     * https://github.com/mapbox/mapbox-gl-js/blob/v0.45.0/src/ui/events.js#L17
     * @extends {Object}
     */
    const MapMouseEvent = (function (Event) {
        const MapMouseEvent = function (type, map, originalEvent, data) {
            if (data === undefined) {
                data = {};
            }
            const point = DOM.mousePos(map.getCanvasContainer(), originalEvent);
            const lngLat = map.unproject(point);
            Event.call(this, type, extend({ point: point, lngLat: lngLat, originalEvent: originalEvent }, data));
            this._defaultPrevented = false;
            this.target = map;
        };
        if (Event) {
            MapMouseEvent.__proto__ = Event;
        }
        MapMouseEvent.prototype = Object.create(Event && Event.prototype);
        MapMouseEvent.prototype.constructor = MapMouseEvent;
        const prototypeAccessors = { defaultPrevented: { configurable: true } };
        MapMouseEvent.prototype.preventDefault = () => {
            this._defaultPrevented = true;
        };
        /**
         * `true` if `preventDefault` has been called.
         * @returns {Boolean}
         */
        prototypeAccessors.defaultPrevented.get = function ()          {
            return this._defaultPrevented;
        };
        Object.defineProperties(MapMouseEvent.prototype, prototypeAccessors);
        return MapMouseEvent;
    }(Event));
    ////////////////////////////////////////////////////////////

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
        let wrappedListener = function (...args) {
            const ev = args[0] || event;
            args[0] = ev;
            (!ev.originalEvent.bubbles || !ev.originalEvent.cancelBubble) && listener.apply(this, args);
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
        for (const layerId of layersId) {
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
    Map.prototype.on = function (type, layerIdOrListener = null, layerListener = null, ...args) {
        const layerId = layerListener == null ? null : layerIdOrListener;
        const listener = layerListener == null ? layerIdOrListener : layerListener;
        if (isInteractiveEvent(type) && layerId) {
            listener.delegates = [];
            if (type === "mouseenter" || type === "mouseover") {
                let mousein = false;
                let mousemove = (e) => {
                    const layer = this.getLayer(layerId);
                    const features = layer ? this.queryRenderedFeatures(e.point, { layers: [layerId] }) : [];
                    if (!features.length) {
                        mousein = false;
                    } else if (!mousein) {
                        mousein = true;
                        listener.call(this, new MapMouseEvent(type, this, e.originalEvent, { features }));
                        e.originalEvent.cancelMouseMove = true;
                    } else {
                        e.originalEvent.stopPropagation();
                    }
                };
                mousemove.event = "special:mousemove";
                let mouseout = () => {
                    mousein = false;
                };
                mouseout.event = "mouseout";
                listener.delegates.push(mousemove);
                listener.delegates.push(mouseout);
            } else if (type === "mouseleave" || type === "mouseout") {
                let mousein = false;
                let mousemove = (e) => {
                    const layer = this.getLayer(layerId);
                    const features = layer ? this.queryRenderedFeatures(e.point, { layers: [layerId] }) : [];
                    if (features.length) {
                        mousein = true;
                    } else if (mousein) {
                        mousein = false;
                        listener.call(this, new MapMouseEvent(type, this, e.originalEvent));
                        e.originalEvent.cancelMouseMove = true;
                    }
                };
                mousemove.event = "special:mousemove";
                let mouseout = (e) => {
                    if (mousein) {
                        mousein = false;
                        listener.call(this, new MapMouseEvent(type, this, e.originalEvent));
                    }
                };
                mouseout.event = "mouseout";
                listener.delegates.push(mousemove);
                listener.delegates.push(mouseout);
            } else {
                let delegate = (e) => {
                    const features = this.getLayer(layerId) ? this.queryRenderedFeatures(e.point, { layers: [layerId] }) : [];
                    if (features.length) {
                        // Here we need to mutate the original event, so that preventDefault works as expected.
                        e.features = features;
                        listener.call(this, e);
                        delete e.features;
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
            return originalMapOnFunc.call(this, type, listener, ...args);
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
    Map.prototype.off = function (type, layerIdOrListener = null, layerListener = null, ...args) {
        const layerId = layerListener == null ? null : layerIdOrListener;
        const listener = layerListener == null ? layerIdOrListener : layerListener;
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
            return originalMapOffFunc.call(this, type, listener, ...args);
        }
    };

    /**
     * Fires an event of the specified type.
     *
     * Respect the *bubble effect*.
     * @param   {object} event event data
     * @returns {Map} this
     * @see [`on` method](#on).
     * @see [`Evented` on *mapboxgl*](https://www.mapbox.com/mapbox-gl-js/api/#evented).
     */
    Map.prototype.fire = function (event, ...args) {
        if (typeof event === "string") {
            event = new Event(event, arguments[1] || {});
        }
        let type = event.type;
        if (isInteractiveEvent(type)) {
            let types;
            if (type == "mousemove") {
                types = ["special:mousemove", type];
            } else {
                types = [type];
            }
            for (type of types) {
                if (!event.originalEvent.cancelMouseMove) {
                    for (let layerEvented of this._getLayersEventedByZIndexFor(type)) {
                        if (type == "special:mousemove") {
                            event.type = "special:mousemove";
                        } else if (type == "mousemove") {
                            event.type = "mousemove";
                        }
                        layerEvented.fire(event);
                    }
                } else {
                    delete event.originalEvent.cancelMouseMove;
                }
            }
            if (event.originalEvent && event.originalEvent.cancelBubble) {
                return this;
            } else {
                return originalMapFireFunc.call(this, event, ...args);
            }
        } else {
            return originalMapFireFunc.call(this, event, ...args);
        }
    };

    return mapboxgl;
}));
