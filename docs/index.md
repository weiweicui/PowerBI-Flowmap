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
* Update 1.1.4:
    * Add **Origin/Destination name** fields: By default, values in **Origin** and **Destination** fields are used in tooltips. However, they may be too long or too ugly if you also want to use them for the geocoding purpose. Now you can set these two fields and show friendly names in tooltips.
    * Add **Advanced - Language**: Can change the language used in the background map.
    * Add **Advanced - Cache**: Store the geocoding results, so they can be reused when you open the report next time.
* Update 1.2.4:
    * Add **Map control** format: The map-related settings (in **Advanced**) are moved here, and add some more:
        * **Auto fit**: Zoom/pan the map to fit everything in the viewport when the selection is changed.
        * **Type**: Change the map style between `Road` and `Aerial`.
    * Add **Map element** format: In case you find some map elements, such as roads and labels, distracting, you can turn them off here.
    * Change the color setting to be consistent with other visuals. By defualt, all flows use the same color. You need to change them manually in the **Flow color**. In addition, only the colors with non-empty labels are displayed in the legend bar.
* Update 1.2.6 (store version):
    * Add **Label** format: Now the content displayed in the bubble labels can be different from the hovering tooltips. If nothing in the field, the names are displayed.
    * Adjust **Width** and **Color** fields: Previously, **Width** field only takes numeric values and **Color** field only takes distrete values. Now they both can take either continuous values or discrete values. However, due to the algorithm limit, `Flow` style does not work with continuous values in the **Color** field.
    * Separate the **Visual style** format (from **Advance - Flow style**): Now it is more prominent. And now only `Flow` style has the number constraint. In particular, I add a `Auto` style. So the visual determines the exact style based on the following rules (of course, you can manually pick one by yourself):
        * Choose `Flow` if the the number of total flows is less than 5, otherwise,
        * Choose `Great circle` if the total row number is less than 500, otherwise,
        * Choose `Straight`.
    * Adjust **Bubble** format: Now you can:
        * Choose to show bubbles for origins or destinations.
        * Just show overall sizes instead of slices.
        * Set bubble to the same (and small) size if **Bubble - Scale** is set to `0%`.
        * Change label background colors for origins or destinations.
    * Add a couple of more default map styles to **Map control - Type**.
* Update 1.3.0:
    * Add the **Legend - Color/Width - (default)** options. By default, the color and width legends are empty and you need to type the labels manually. Now when you turn on the **(default)** swithces, the legend will directly use the default labels if you have not specify them explicitly.
* Update 1.3.1:
    * Refine the **Bubble - Scale**. Use sigmoid function to scale bubble sizes when they are too large or too small.
* Update 1.3.2:
    * Add a **Color - (Autofill)** switch. It only shows when color field is categorical. It will automatically give distinct colors to unspecified categories.
* Update 1.3.3:
    * Fix a bug that map related formats cannot remember settings.
* Update 1.4.*:
    * Update to custom visual api v2.6. This should fix some issues due to api issues. But since the implementation is changed a lot, bugs are expected. Please comment below if found.
    * Remove the filter operation from this visual (i.e., now cannot click on legend or flows to highlight.)
    * Show bubbles for self-linked flow. It still cannot show lines if the origin and destination are the same, but we can show a circle on the map if the bubble visualization is turned on.
    * Remove **Bubble - For - Both** option.
    * Add a **Map control - Type - Hidden** option to hide the underlying map completely.



## How to Use (Latest Version)
* Required fields:
    * **Origin** and **Destination**: These two fields are used to construct relationships. The content there may be treated as addresses and used to query geo-locations (through [Bing Maps REST Services](https://msdn.microsoft.com/en-us/library/ff701713.aspx)) if latitude/longitude are not specified.

* Optional fields:
    * **Width**: This field is used to compute flow widths. Negative values will be ignored. The default value is 1. The field can be numerical or categorical:
        * When numerical, you can specify a min and max width to map them on the map.
        * When categorical, such as texts, you can specify the width for each category, and a default value is used is not specified.
    * **Color**: This field is used to compute flow colors. The field can be numerical or categorical:
        * When numerical, you can set a min and max color to map them on the map, and values in between are interpolated.
        * When categorical, such as texts, you can sepcify a color for each category. A default color is used when not specified.            
    >Please note that, due to implementation limit, `Flow` style only works with categorical color values.
    * **Origin/Destination latitude/longitude**: These fields specify the geo-locations of sources and targets.
  > Please note that only decimal numbers are accepted: latitudes range from -90 to 90, while longitudes range from -180 to 180.
    * **Origin/Destination name**: These fields are used to represent origins and destinations when displayed in tooltips or labels. Sometimes, the values in the **Origin** and **Destination** fields are needed for geo-coding and cannot be user-friendly. So these two fields can help put friendly names in the report.
    * **Tooltip**: You can choose what to show when hovering over a line or a bubble. By default, the names are displayed.
    * **Label**: We can show labels for bubbles. This field will decide the content in the labels. By default the names are used. You can turn on this feature in the **Bubble - Label** panel.

* Major settings:
    * **Visual style**: You can change between `Flow`, `Great circle`, and `Straight line`.
    In particular, I add a `Auto` style. So the visual determines the exact style based on the following rules (of course, you can manually pick one by yourself):
        * Choose `Flow` if the the number of total flows is less than 5, otherwise,
        * Choose `Great circle` if the total row number is less than 500, otherwise,
        * Choose `Straight`.
    >Please note that only the `Flow` style has a constraint to limit the number of flows displayed in the view. In addition, you can choose to bundle flows based on origins or destinations.
    * **Color** and **Width**: These two panels allow you to adjust line attributes. Their contents may be adjusted in different situations.
    * **Bubble - Label**: You need to set it to make the **Label** field works.
    * **Detail format**: This panel controls how numerical values are formatted in tooltips or labels.
    * **Map control - Auto fit**: When it is on, whe visual will try to fit everything in one view when a data change is detected.
    * **Map element**: There are some high-level controls about what elements can be displayed in the visual.




* Need more help? Please leave a comment below.
