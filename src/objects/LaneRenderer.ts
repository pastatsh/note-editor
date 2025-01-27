import Pixi from "../containers/Pixi";
import { Fraction, IFraction, inverseLerp, lerp, Vector2 } from "../math";
import { Measure, sortMeasure } from "./Measure";
import {
  LaneTemplate,
  MusicGameSystemNoteType,
} from "../stores/MusicGameSystem";
import { drawQuad } from "../utils/drawQuad";
import { GetLineInfoFromPool, GetLinePointInfoFromPool } from "../utils/pool";
import { Lane, LineInfo, LinePointInfo } from "./Lane";
import { LanePoint } from "./LanePoint";
import { Graphics } from "pixi.js";

export interface LinePoint {
  measureIndex: number;
  measurePosition: IFraction;
  horizontalSize: number;
  horizontalPosition: IFraction;
}

export interface NotePointInfo {
  lane: Lane;
  linePointInfo: LinePointInfo;
  horizontalIndex: number;
  verticalIndex: number;
  measureIndex: number;
}

export function getLines(points: LinePoint[], measures: Measure[]): LineInfo[] {
  const lines: LineInfo[] = [];

  const _points = points
    .slice()
    .sort(sortMeasure)
    .map((p) => ({
      x: Fraction.to01(p.horizontalPosition),
      width: p.horizontalSize / p.horizontalPosition.denominator,
      value: p.measureIndex + Fraction.to01(p.measurePosition),
    }));

  for (let i = 0; i < _points.length - 1; ++i) {
    const p1 = _points[i];
    const p2 = _points[i + 1];

    // 値を点に変換
    const toLinePointInfo = (measureIndex: number, value: number) => {
      const measure = measures[measureIndex];
      const p = inverseLerp(p1.value, p2.value, value);
      return GetLinePointInfoFromPool(
        measure.x + measure.width * lerp(p1.x, p2.x, p),
        measure.y + measure.height * (measureIndex + 1 - value),
        measure.width * lerp(p1.width, p2.width, p)
      );
    };

    let v1 = p1.value;
    let v2 = Math.min(Math.floor(v1) + 1, p2.value);
    while (true) {
      const m = Math.floor(v1);
      lines.push(
        GetLineInfoFromPool(
          measures[m],
          toLinePointInfo(m, v1),
          toLinePointInfo(m, v2)
        )
      );
      if (v2 === p2.value) {
        break;
      }
      v1 = v2;
      v2 = Math.min(v2 + 1, p2.value);
    }
  }

  return lines;
}

const linesCache = new WeakMap<Lane, LineInfo[]>();

export interface ILaneRenderer {
  getNotePointInfo(
    lane: Lane,
    measure: Measure,
    horizontal: IFraction,
    vertical: IFraction
  ): LinePointInfo | null;

  getNotePointInfoFromMousePosition(
    lane: Lane,
    measure: Measure,
    nextMeasure: Measure,
    measureDivision: number,
    mousePosition: Vector2,
    isResizeOrDragMode?: boolean
  ): NotePointInfo | null;

  render(
    lane: Lane,
    graphics: Graphics,
    lanePointMap: Map<string, LanePoint>,
    measures: Measure[],
    drawHorizontalLineTargetMeasure: Measure | null,
    noteType: MusicGameSystemNoteType
  ): void;

  defaultRender(
    graphics: Graphics,
    lines: LineInfo[],
    laneTemplate: LaneTemplate
  ): void;
}

class LaneRenderer implements ILaneRenderer {
  defaultRender(
    graphics: Graphics,
    lines: LineInfo[],
    laneTemplate: LaneTemplate
  ) {
    const renderArea = Pixi.instance!.getRenderArea();
    for (const line of lines) {
      // レーンが描画範囲外なので描画しない
      if (
        (renderArea.left > line.start.point.x + line.start.width &&
          renderArea.left > line.end.point.x + line.start.width) ||
        (renderArea.right < line.start.point.x &&
          renderArea.right < line.end.point.x)
      )
        continue;

      drawQuad(
        graphics,
        line.start.point,
        Vector2.add(line.start.point, new Vector2(line.start.width, 0)),
        Vector2.add(line.end.point, new Vector2(line.end.width, 0)),
        line.end.point,
        Number(laneTemplate.color)
      );

      for (let i = 0; i < laneTemplate.division + 1; ++i) {
        graphics
          .lineStyle(1, 0xffffff)
          .moveTo(
            line.start.point.x + (line.start.width / laneTemplate.division) * i,
            line.start.point.y
          )
          .lineTo(
            line.end.point.x + (line.end.width / laneTemplate.division) * i,
            line.end.point.y
          );
      }
    }
  }

  /**
   * 小節番号からノーツの位置とサイズを取得する
   * @param lane
   * @param measure
   * @param horizontal
   * @param vertical
   */
  public getNotePointInfo(
    lane: Lane,
    measure: Measure,
    horizontal: IFraction,
    vertical: IFraction
  ): LinePointInfo | null {
    // y座標
    const y = measure.y + measure.height * (1 - Fraction.to01(vertical));

    // y座標が含まれるライン
    const targetLine = (linesCache.get(lane) || []).find(
      (line) =>
        line.measure === measure &&
        line.start.point.y >= y &&
        line.end.point.y <= y
    );
    if (!targetLine) {
      return null;
    }

    // ライン上でのy座標の位置
    const start = targetLine!.start;
    const end = targetLine!.end;
    const rate = inverseLerp(end.point.y, start.point.y, y);

    // x座標を補完で求める
    const getX = (info: LinePointInfo, i: number) =>
      info.point.x +
      info.width * (Fraction.to01(horizontal) + i / horizontal.denominator);
    const left = lerp(getX(end, 0), getX(start, 0), rate);
    const right = lerp(getX(end, 1), getX(start, 1), rate);

    return {
      point: new Vector2(left, y),
      width: right - left,
    };
  }

  public getNotePointInfoFromMousePosition(
    lane: Lane,
    measure: Measure,
    nextMeasure: Measure,
    measureDivision: number,
    mousePosition: Vector2,
    isResizeOrDragMode = false
  ): NotePointInfo | null {
    const height = measure.height / measureDivision / 2;
    const horizontal = new Fraction(0, lane.division);
    const vertical = new Fraction(0, measureDivision);

    // リサイズやドラッグ中は小節の範囲外も判定する
    const left = isResizeOrDragMode ? -lane.division : 0;
    const right = lane.division + (isResizeOrDragMode ? 1 : 0);

    for (let i = left; i < right; i++) {
      horizontal.numerator = i;
      for (let j = 0; j < measureDivision + 1; j++) {
        vertical.numerator = j;

        const data = this.getNotePointInfo(lane, measure, horizontal, vertical);

        if (
          data &&
          mousePosition.x >= data!.point.x &&
          mousePosition.x < data!.point.x + data!.width &&
          mousePosition.y >= data!.point.y - height &&
          mousePosition.y < data!.point.y + height
        ) {
          // 次の小節の最初に配置するべき
          if (j === measureDivision) {
            return {
              lane,
              linePointInfo: this.getNotePointInfo(
                lane,
                nextMeasure,
                horizontal,
                new Fraction(0, measureDivision)
              )!,
              horizontalIndex: i,
              verticalIndex: measureDivision - 1,
              measureIndex: nextMeasure.index,
            };
          }

          return {
            lane,
            linePointInfo: data!,
            horizontalIndex: i,
            verticalIndex: measureDivision - j - 1,
            measureIndex: measure.index,
          };
        }
      }
    }

    return null;
  }

  // private linesCache: LineInfo[] = [];

  customRender(render: any) {}

  render(
    lane: Lane,
    graphics: Graphics,
    lanePointMap: Map<string, LanePoint>,
    measures: Measure[],
    drawHorizontalLineTargetMeasure: Measure | null,
    noteType: MusicGameSystemNoteType
  ): void {
    const lines = getLines(
      lane.points.map((point) => lanePointMap.get(point)!),
      measures
    );

    // キャッシュしておく
    linesCache.set(lane, lines);

    const laneTemplate = Pixi.instance!.injected.editor!.currentChart!.musicGameSystem.laneTemplateMap.get(
      lane.templateName
    )!;

    this.defaultRender(graphics, lines, laneTemplate);

    if (noteType.excludeLanes.includes(lane.templateName)) return;

    // 選択中の小節に乗っているレーン
    const targetMeasureLines = !drawHorizontalLineTargetMeasure
      ? []
      : lines.filter(
          ({ measure }) => measure === drawHorizontalLineTargetMeasure
        );

    for (const line of targetMeasureLines) {
      for (let i = 1; i < lane.division; ++i) {
        const width = !laneTemplate.boldInterval ? 1 : i % 4 === 0 ? 2 : 1;
        graphics
          .lineStyle(width, 0xffffff)
          .moveTo(
            line.start.point.x + (line.start.width / lane.division) * i,
            line.start.point.y
          )
          .lineTo(
            line.end.point.x + (line.end.width / lane.division) * i,
            line.end.point.y
          );
      }
    }
  }
}

export default new LaneRenderer();
