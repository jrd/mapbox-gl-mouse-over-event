# Mapbox GL Mouse over event fix plugin

The current implementation of `mouseenter` and `mouseleave` events in *mapbox-gl* are a little buggy:
- a `mouseenter` event is generated on a layer *X* even if layer *Y* is above layer *X* on the enter region.
- a `mouseleave` event is generated on a layer *Y* if layer *Y* is above layer *X* and the mouse is moved when in a region that belongs to both *X* and *Y*.
- the bubble effect found commonly in the DOM is not respected (stopPropagation for instance).

This plugin attempt to correct those misbehaviors by providng the following new method on `map`:
- `onMouseOver(layerId, enterCallback, exitCallback, moveOnCallback)`
- `onClick(layerId, callback)`

For more info, see the [documentation API](https://jrd.github.io/mapbox-gl-mouse-over-event/)
