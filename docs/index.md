---
layout: default
title: PowerBI - Flowmap Custom Visual
image_sliders:
  - slider1
---

## Background

Flow maps are a special type of network visualization for object movements, such as the number of people in a migration. A typical flow map, which contains one source and multiple targets, is visualized as a flow-style tree overlaid on top of a map.

{% include slider.html selector="slider1" %}

The line thicknesses are scaled to represent the values between the source (the root) and the targets (the leaves). By merging edges together, Flow maps can reduce visual clutter and enhance directional trends.

## Where to Get It

You can get it from the [Office Store](https://store.office.com/en-us/app.aspx?assetid=WA104380901&sourcecorrid=ae7baae3-68e1-488c-b34c-ac1e9f8cc8d7&searchapppos=62&appredirect=false&omkt=en-US&ui=en-US&rs=en-US&ad=US) or the [_dist_](https://github.com/weiweicui/PowerBI-Flowmap/tree/master/dist) folder in this [_repo_](https://github.com/weiweicui/PowerBI-Flowmap/).

* Update 1.1.3:
    * Add **Advanced - Flow style**: Can change the visualization style between `curve`, `great circle`, and `straight line`.
    * Add an optional field **Tooltip**: Now it is customizable. By default, the value field is used.
    * Add **Tooltip Format**: Can customize the format of values (if they are numbers) displayed in tooltips.
    * Remove the flow limit: Now can set any number in **Advanced - Flow limit**, which is previously capped by 10. However, the predefined good categorical colors may run out.
* Update 1.1.4 (store version):
    * Add **Origin/Destination name** fields: By default, values in **Origin** and **Destination** fields are used in tooltips. However, they may be too long or too ugly if you also want to use them for the geocoding purpose. Now you can set these two fields and show friendly names in tooltips.
    * Add **Advanced - Language**: Can change the language used in the background map.
    * Add **Advanced - Cache**: Store the geocoding results, so they can be reused when you open the report next time.
* Update 1.2.4:
    * Add **Map control** format: The map-related settings (in **Advanced**) are moved here, and add some more:
        * **Auto fit**: Zoom/pan the map to fit everything in the viewport when the selection is changed.
        * **Type**: Change the map style between `Road` and `Aerial`.
    * Add **Map element** format: In case you find some map elements, such as roads and labels, distracting, you can turn them off here.
    * Change the color setting to be consistent with other visuals. By defualt, all flows use the same color. You need to change them manually in the **Flow color**. In addition, only the colors with non-empty labels are displayed in the legend bar.
* Update 1.2.5:
    * Add **Label** format: Now the content displayed in the bubble labels can be different from the hovering tooltips. If nothing in the field, the names are displayed.
    * Adjust **Width** and **Color** fields: Previously, **Width** field only takes numeric values and **Color** field only takes distrete values. Now they both can take either continuous values or discrete values. However, due to the algorithm limit, `Flow` style does not work with continuous values in the **Color** field.
    * Separate the **Visual style** format (from **Advance - Flow stle**): Now it is more prominent. And now only `Flow` style has the number constraint. In particular, I add a `Auto` style. So the visual determines the exact style based on the following rules (of course, you can manually pick one by yourself):
        * Choose `Flow` if the the number of total flows is less than 5, otherwise,
        * Choose `Great circle` if the total row number is less than 500, otherwise,
        * Choose `Straight`.
    * Adjust **Bubble** format: Now you can:
        * Choose to show bubbles for origins or destinations.
        * Just show overall sizes instead of slices.
        * Set bubble to the same size if **Bubble - Scale** is set to `0%`.
        * Change label background colors for origins or destinations.
    * Add a couple of more default map styles to **Map control - Type**.

## How to Use (v1.1.4)
* Required fields:
    * **Origin** and **Destination**: These two fields are used to construct relationships. They may be treated as addresses and used to query geo-locations (through [Bing Maps REST Services](https://msdn.microsoft.com/en-us/library/ff701713.aspx)) if latitude/longitude are not specified.
    * **Value**: This field is used to compute flow widths. Negative values will be ignored.
* Optional fields:
    * **Category**: If specified, the flows that have the same category value will be colored the same.
    * **Origin/Destination latitude/longitude**: These fields specify the geo-locations of sources and targets.

* Special settings:
    * **Advanced - Flow type**: It can be either `Out-flow`, which constructs flows based on the origins, or `In-flow`, which constructs flows based on the destinations.
    * **Advanced - Flow limit**: This controls the max number of flows that can be displayed simultaneously.


* Need more help? Please leave a comment below.
