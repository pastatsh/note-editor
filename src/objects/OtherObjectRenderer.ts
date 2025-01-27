import { Measure } from "./Measure";
import * as PIXI from "pixi.js";
import { parseRgba } from "../utils/color";
import { OtherObjectType } from "../stores/MusicGameSystem";
import Pixi from "../containers/Pixi";
import { OtherObject } from "./OtherObject";

export class _OtherObjectRenderer {
  private readonly labelWidth = 60;
  private readonly labelHeight = 20;

  public getBounds(otherObject: OtherObject, measure: Measure): PIXI.Rectangle {
    const lane = measure;

    const y =
      lane.y +
      lane.height -
      (lane.height / otherObject.measurePosition!.denominator) *
        otherObject.measurePosition!.numerator;

    const colliderW = measure.width;
    const colliderH = 4;
    const _x = measure.x;
    const _y = y - colliderH / 2;

    return new PIXI.Rectangle(_x, _y, colliderW, colliderH);
  }

  private drawedPositions: {
    [key: string]: number;
  } = {};

  private renderOrders = new Map<OtherObject, number>();

  public updateFrame() {
    this.drawedPositions = {};
    this.renderOrders.clear();
  }

  public getRenderOrder(object: OtherObject, measure: Measure) {
    return this.renderOrders.get(object)!;
  }

  /**
   * 領域を描画する
   * @param graphics 対象グラフィック
   * @param rgba 枠の色
   * @returns 重なり順序
   */
  public drawBounds(
    object: OtherObject,
    measure: Measure,
    graphics: PIXI.Graphics,
    rgba: number
  ) {
    const { color, alpha } = parseRgba(rgba);
    const bounds = this.getBounds(object, measure);
    graphics
      .lineStyle(2, color, alpha)
      .drawRect(
        bounds.x - 2,
        bounds.y - 2,
        bounds.width + 4,
        bounds.height + 4
      );

    const renderOrder = this.renderOrders.get(object)!;

    const y =
      bounds.y + bounds.height / 2 - (renderOrder - 1.5) * this.labelHeight;

    graphics
      .moveTo(bounds.x + bounds.width, y)
      .lineTo(bounds.x + bounds.width + this.labelWidth, y);

    return renderOrder;
  }

  private renderTextValue(
    otherObjectType: OtherObjectType,
    object: OtherObject,
    bounds: PIXI.Rectangle,
    labelAddY: number,
    measure: Measure
  ) {
    Pixi.instance!.drawText(
      `${otherObjectType.name}: ${object.value}`,
      bounds.x + bounds.width + 4,
      bounds.y + bounds.height / 2 - labelAddY,
      {
        fontSize: 16,
        fill: Number(otherObjectType.color),
      },
      measure.width,
      [0, 0.5]
    );
  }

  private renderPointValue(
    otherObjectType: OtherObjectType,
    object: OtherObject,
    graphics: PIXI.Graphics,
    bounds: PIXI.Rectangle,
    labelAddY: number,
    measure: Measure
  ) {
    const text = Pixi.instance!.drawText(
      `${otherObjectType.name}`,
      bounds.x + bounds.width + 4,
      bounds.y + bounds.height / 2 - labelAddY,
      {
        fontSize: 16,
        fill: Number(otherObjectType.color),
      },
      measure.width,
      [0, 0.5]
    );

    const size = 20;
    const margin = 4;

    const rectX = bounds.x + bounds.width + 4 + margin + text.width;
    const rectY = bounds.y + bounds.height / 2 - labelAddY - size / 2;

    graphics
      .lineStyle(1, Number(otherObjectType.color))
      .drawRect(rectX, rectY, size, size);

    const { normalizedPoint } = object.pointValue;

    graphics
      .lineStyle(1, Number(otherObjectType.color))
      .moveTo(rectX + size / 2, rectY + size / 2)
      .lineTo(
        rectX + normalizedPoint.x * size,
        rectY + normalizedPoint.y * size
      );
  }

  public render(
    otherObjectTypes: OtherObjectType[],
    object: OtherObject,
    graphics: PIXI.Graphics,
    measure: Measure
  ) {
    const otherObjectType = otherObjectTypes[object.type];

    const bounds = this.getBounds(object, measure);

    const positionText = `${bounds.x}/${bounds.y}`;

    let labelAddY = 0;

    if (positionText in this.drawedPositions) {
      labelAddY += this.drawedPositions[positionText] * 20;
      this.drawedPositions[positionText]++;
    } else {
      this.drawedPositions[positionText] = 1;
    }

    this.renderOrders.set(object, this.drawedPositions[positionText]);

    graphics
      .lineStyle(0)
      .beginFill(Number(otherObjectType.color), 0.75)
      .drawRect(measure.x, bounds.y, measure.width, bounds.height)
      .endFill();

    switch (otherObjectType.valueType) {
      case "point":
        this.renderPointValue(
          otherObjectType,
          object,
          graphics,
          bounds,
          labelAddY,
          measure
        );
        break;

      default:
        this.renderTextValue(
          otherObjectType,
          object,
          bounds,
          labelAddY,
          measure
        );
    }
  }
}

export const OtherObjectRenderer = new _OtherObjectRenderer();
