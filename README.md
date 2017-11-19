# Mapbox GL Mouse over event fix plugin

The current implementation of `mouseenter` and `mouseleave` events in *mapbox-gl* are a little buggy:
- a `mouseenter` event is generated on a layer *X* even if layer *Y* is above layer *X* on the enter region.
- a `mouseleave` event is generated on a layer *Y* if layer *Y* is above layer *X* and the mouse is moved when in a region that belongs to both *X* and *Y*.
- the [*bubble effect*](https://developer.mozilla.org/en-US/docs/Web/API/Event/bubbles) found commonly in the DOM is not respected ([`stopPropagation`](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Examples#Example_5:_Event_Propagation) for instance).

This plugin attempt to correct those misbehaviors but does not implement [`stopImmediatePropagation`](https://developer.mozilla.org/en-US/docs/Web/API/Event/stopImmediatePropagation).

For more info, see the [documentation API](https://jrd.github.io/mapbox-gl-mouse-over-event/)
