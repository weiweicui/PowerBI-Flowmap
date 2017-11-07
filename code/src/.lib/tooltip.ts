import { host } from './host';
import { Selection, Any, event, select, touches } from 'd3-selection';
//** copy from powerbi-visuals-utils-tooltiputils */
    type Selector = powerbi.data.Selector;
    type IVisualHost = powerbi.extensibility.visual.IVisualHost;
    type VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
    type ISelectionId = powerbi.extensibility.ISelectionId;

    module pbi.tooltip {
        export interface TooltipEventArgs<TData> {
            data: TData;
            coordinates: number[];
            elementCoordinates: number[];
            context: HTMLElement;
            isTouchEvent: boolean;
        }

        export interface ITooltipServiceWrapper {
            addTooltip<T>(
                selection: Any<T>,//d3.Selection<any>,
                getTooltipInfoDelegate: (args: TooltipEventArgs<T>) => VisualTooltipDataItem[],
                getDataPointIdentity?: (args: TooltipEventArgs<T>) => ISelectionId,
                reloadTooltipDataOnMouseMove?: boolean): void;
            hide(): void;
        }

        export interface TooltipEnabledDataPoint {
            tooltipInfo?: VisualTooltipDataItem[];
        }
    }

    module pbi.tooltip.touch {
        export function touchStartEventName(): string {
            let eventName: string = "touchstart";

            if (window["PointerEvent"]) {
                // IE11
                eventName = "pointerdown";
            }

            return eventName;
        }

        export function touchEndEventName(): string {
            let eventName: string = "touchend";

            if (window["PointerEvent"]) {
                // IE11
                eventName = "pointerup";
            }

            return eventName;
        }

        export function usePointerEvents(): boolean {
            let eventName: string = touchStartEventName();

            return eventName === "pointerdown" || eventName === "MSPointerDown";
        }
    }

    module pbi.tooltip {
        // powerbi.visuals
        import ISelectionId = powerbi.visuals.ISelectionId;

        // powerbi.extensibility
        import ITooltipService = powerbi.extensibility.ITooltipService;
        import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
        import IVisualHost = powerbi.extensibility.visual.IVisualHost;

        const DefaultHandleTouchDelay = 1000;

        export function createTooltipServiceWrapper(
            tooltipService: ITooltipService,
            rootElement: Element,
            handleTouchDelay: number = DefaultHandleTouchDelay): ITooltipServiceWrapper {

            return new TooltipServiceWrapper(
                tooltipService,
                rootElement,
                handleTouchDelay);
        }

        export class TooltipServiceWrapper implements ITooltipServiceWrapper {
            private handleTouchTimeoutId: number;
            private visualHostTooltipService: ITooltipService;
            private rootElement: Element;
            private handleTouchDelay: number;

            constructor(
                tooltipService: ITooltipService,
                rootElement: Element,
                handleTouchDelay: number = DefaultHandleTouchDelay) {

                this.visualHostTooltipService = tooltipService;
                this.rootElement = rootElement;
                this.handleTouchDelay = handleTouchDelay;
            }

            public addTooltip<T>(
                selection: Any<T>,
                getTooltipInfoDelegate: (args: TooltipEventArgs<T>) => VisualTooltipDataItem[],
                getDataPointIdentity?: (args: TooltipEventArgs<T>) => ISelectionId,
                reloadTooltipDataOnMouseMove?: boolean): void {

                if (!selection || !this.visualHostTooltipService.enabled()) {
                    return;
                }

                let rootNode: Element = this.rootElement;

                // Mouse events
                selection.on("mouseover.tooltip", () => {
                    // Ignore mouseover while handling touch events
                    if (!this.canDisplayTooltip(event)) {
                        return;
                    }

                    let tooltipEventArgs = this.makeTooltipEventArgs<T>(rootNode, true, false);
                    if (!tooltipEventArgs) {
                        return;
                    }

                    let tooltipInfo = getTooltipInfoDelegate(tooltipEventArgs);
                    if (tooltipInfo == null) {
                        return;
                    }

                    let selectionIds: ISelectionId[] = this.getSelectionIds<T>(tooltipEventArgs, getDataPointIdentity);

                    this.visualHostTooltipService.show({
                        coordinates: tooltipEventArgs.coordinates,
                        isTouchEvent: false,
                        dataItems: tooltipInfo,
                        identities: selectionIds
                    });
                });

                selection.on("mouseout.tooltip", () => {
                    this.visualHostTooltipService.hide({
                        isTouchEvent: false,
                        immediately: false,
                    });
                });

                selection.on("mousemove.tooltip", () => {
                    // Ignore mousemove while handling touch events
                    if (!this.canDisplayTooltip(event)) {
                        return;
                    }

                    let tooltipEventArgs = this.makeTooltipEventArgs<T>(rootNode, true, false);
                    if (!tooltipEventArgs) {
                        return;
                    }

                    let tooltipInfo: VisualTooltipDataItem[];
                    if (reloadTooltipDataOnMouseMove) {
                        tooltipInfo = getTooltipInfoDelegate(tooltipEventArgs);

                        if (tooltipInfo == null) {
                            return;
                        }
                    }

                    let selectionIds: ISelectionId[] = this.getSelectionIds<T>(tooltipEventArgs, getDataPointIdentity);

                    this.visualHostTooltipService.move({
                        coordinates: tooltipEventArgs.coordinates,
                        isTouchEvent: false,
                        dataItems: tooltipInfo,
                        identities: selectionIds
                    });
                });

                // --- Touch events ---

                let touchStartEventName: string = touch.touchStartEventName(),
                    touchEndEventName: string = touch.touchEndEventName(),
                    isPointerEvent: boolean = touch.usePointerEvents();

                selection.on(touchStartEventName + ".tooltip", () => {
                    this.visualHostTooltipService.hide({
                        isTouchEvent: true,
                        immediately: true,
                    });

                    let tooltipEventArgs = this.makeTooltipEventArgs<T>(rootNode, isPointerEvent, true);
                    if (!tooltipEventArgs) {
                        return;
                    }

                    let tooltipInfo = getTooltipInfoDelegate(tooltipEventArgs),
                        selectionIds: ISelectionId[] = this.getSelectionIds<T>(tooltipEventArgs, getDataPointIdentity);

                    this.visualHostTooltipService.show({
                        coordinates: tooltipEventArgs.coordinates,
                        isTouchEvent: true,
                        dataItems: tooltipInfo,
                        identities: selectionIds
                    });
                });

                selection.on(touchEndEventName + ".tooltip", () => {
                    this.visualHostTooltipService.hide({
                        isTouchEvent: true,
                        immediately: false,
                    });

                    if (this.handleTouchTimeoutId) {
                        clearTimeout(this.handleTouchTimeoutId);
                    }

                    // At the end of touch action, set a timeout that will let us ignore the incoming mouse events for a small amount of time
                    // TODO: any better way to do this?
                    this.handleTouchTimeoutId = <any>setTimeout(() => {
                        this.handleTouchTimeoutId = undefined;
                    }, this.handleTouchDelay);
                });
            }

            private getSelectionIds<T>(
                tooltipEventArgs: TooltipEventArgs<T>,
                getDataPointIdentity: (args: TooltipEventArgs<T>) => ISelectionId): ISelectionId[] {

                const selectionId: ISelectionId = getDataPointIdentity
                    ? getDataPointIdentity(tooltipEventArgs)
                    : null;

                return selectionId
                    ? [selectionId]
                    : [];
            }

            public hide(): void {
                this.visualHostTooltipService.hide({ immediately: true, isTouchEvent: false });
            }

            private makeTooltipEventArgs<T>(
                rootNode: Element,
                isPointerEvent: boolean,
                isTouchEvent: boolean): TooltipEventArgs<T> {

                let target = <HTMLElement>(<Event>event).target,
                    data = select(target).datum() as T;

                let mouseCoordinates: number[] = this.getCoordinates(rootNode, isPointerEvent),
                    elementCoordinates: number[] = this.getCoordinates(target, isPointerEvent);

                let tooltipEventArgs: TooltipEventArgs<T> = {
                    data: data,
                    coordinates: mouseCoordinates,
                    elementCoordinates: elementCoordinates,
                    context: target,
                    isTouchEvent: isTouchEvent
                };

                return tooltipEventArgs;
            }

            private canDisplayTooltip(d3Event: any): boolean {
                let canDisplay: boolean = true,
                    mouseEvent: MouseEvent = <MouseEvent>d3Event;

                if (mouseEvent.buttons !== undefined) {
                    // Check mouse buttons state
                    let hasMouseButtonPressed = mouseEvent.buttons !== 0;
                    canDisplay = !hasMouseButtonPressed;
                }

                // Make sure we are not ignoring mouse events immediately after touch end.
                canDisplay = canDisplay && (this.handleTouchTimeoutId == null);

                return canDisplay;
            }

            private getCoordinates(rootNode: Element, isPointerEvent: boolean): number[] {
                let coordinates: number[];

                if (isPointerEvent) {
                    // DO NOT USE - WebKit bug in getScreenCTM with nested SVG results in slight negative coordinate shift
                    // Also, IE will incorporate transform scale but WebKit does not, forcing us to detect browser and adjust appropriately.
                    // Just use non-scaled coordinates for all browsers, and adjust for the transform scale later (see lineChart.findIndex)
                    // coordinates = d3.mouse(rootNode);

                    // copied from d3_eventSource (which is not exposed)
                    let e = <MouseEvent>event, s;

                    while (s = (<d3.BaseEvent>e).sourceEvent) e = s;

                    let rect: ClientRect = rootNode.getBoundingClientRect();

                    coordinates = [
                        e.clientX - rect.left - rootNode.clientLeft,
                        e.clientY - rect.top - rootNode.clientTop
                    ];
                }
                else {
                    let touchCoordinates = touches(rootNode as any);

                    if (touchCoordinates && touchCoordinates.length > 0) {
                        coordinates = touchCoordinates[0];
                    }
                }

                return coordinates;
            }
        }
    }

//** end of copy */

type ITooltipService = pbi.tooltip.ITooltipServiceWrapper;
type Args<T> = pbi.tooltip.TooltipEventArgs<T>;

export module tooltip {
    var service = null as ITooltipService;

    export function init(options: powerbi.extensibility.visual.VisualConstructorOptions) {
        service = pbi.tooltip.createTooltipServiceWrapper(options.host.tooltipService, options.element);
    }

    export function add<T>(selection: Any<T>, getTooltipInfoDelegate: (args: Args<T>) => VisualTooltipDataItem[]) {
        service.addTooltip(selection, getTooltipInfoDelegate);
    }

    export function hide() {
        service.hide();
    }

    export function setup(role: string) {
        
    }
}