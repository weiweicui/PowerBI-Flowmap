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
* Update 1.2.X:
    * Add **Map control** format: The map-related settings (in **Advanced**) are moved here, and add some more.
    * Add **Map element** format: In case you find some map elements, such as roads and labels, distracting, you can turn them off here.
    * Change the color setting to be consistent with other visuals. By defualt, all flows use the same color. You need to change them manually in the **Flow color**. In addition, only the colors with non-empty labels are displayed in the legend bar.

## How to Use
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
