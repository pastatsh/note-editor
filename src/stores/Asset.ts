import { action, observable } from "mobx";
import { guid } from "../util";
import { CustomNoteLineRenderer, HowlPool } from "../stores/MusicGameSystem";

import * as Electrom from "electron";

import { __require } from "../utils/node";

const fs = (window as any).require("fs");
const util = __require("util");
const path = __require("path");

import { getUrlParams } from "../utils/url";

const electron = (window as any).require("electron");
const remote = electron.remote as Electrom.Remote;

import {
  normalizeMusicGameSystem,
  LaneTemplate,
  NoteType
} from "../stores/MusicGameSystem";

function parseJSON(text: string) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return {};
  }
}

interface IStore {}

import CustomRendererUtility from "../utils/CustomRendererUtility";

import MusicGameSystem from "./MusicGameSystem";
import Chart from "./Chart";

export default class Asset implements IStore {
  @observable
  audioAssetPaths: string[] = [];

  @observable
  musicGameSystems: MusicGameSystem[] = [];

  @action
  addMusicGameSystem = (value: MusicGameSystem) =>
    this.musicGameSystems.push(value);

  /**
   * ローカルストレージから譜面を読み込む
   */
  async debugInitialize() {
    if (localStorage.getItem("chart")) {
      Chart.fromJSON(localStorage.getItem("chart")!);
    }
  }

  async loadAssets() {
    const urlParams = getUrlParams();

    // 音源を読み込む
    await this.checkAudioAssetDirectory(decodeURIComponent(urlParams.aap));

    // MusicGameSystem を読み込む
    {
      const directories: any[] = await util.promisify(fs.readdir)(
        urlParams.mgsp
      );

      for (const directory of directories) {
        const dirPath = path.join(urlParams.mgsp, directory);
        if (!fs.statSync(dirPath).isDirectory()) continue;

        const files = (await util.promisify(fs.readdir)(dirPath)) as any[];

        var fileList = files.filter(file => file.endsWith(".json"));
        console.log("MusicGameSystem を読み込みます", fileList);
        for (const file of fileList) {
          const buffer: Buffer = await util.promisify(fs.readFile)(
            path.join(urlParams.mgsp, directory, file)
          );

          const json = parseJSON(buffer.toString());
          await this.loadMusicGameSystem(json, urlParams.mgsp, directory);
        }
      }
    }
  }

  /**
   * 音源を読み込む
   * @param path 音源のパス
   */
  async loadAudio(path: string) {
    const extension = path.split(".").pop()!;

    const buffer = await util.promisify(fs.readFile)(path);

    const blob = new Blob([buffer], { type: `audio/${extension}` });
    const src = URL.createObjectURL(blob);

    return new Howl({ src: src, format: [extension] });
  }

  /**
   * 音ゲーシステムを読み込む
   * @param json 対象 JSON
   * @param rootPath 音ゲーシステムのパス
   * @param directory 音ゲーシステムの階層
   */
  async loadMusicGameSystem(json: any, rootPath: string, directory: string) {
    const musicGameSystems = normalizeMusicGameSystem(json);

    // SE マップを生成する
    musicGameSystems.seMap = new Map<string, HowlPool>();

    // 名前をキーにしたレーンテンプレートのマップを生成する
    musicGameSystems.laneTemplateMap = new Map<string, LaneTemplate>();
    for (const laneTemplate of musicGameSystems.laneTemplates) {
      musicGameSystems.laneTemplateMap.set(laneTemplate.name, laneTemplate);
    }

    // 名前をキーにしたノートタイプのマップを生成する
    musicGameSystems.noteTypeMap = new Map<string, NoteType>();
    for (const noteType of musicGameSystems.noteTypes || []) {
      if (!noteType.customProps) noteType.customProps = [];

      // 判定音源を読み込む
      if (noteType.editorProps.se) {
        const sePath = path.join(rootPath, directory, noteType.editorProps.se);
        musicGameSystems.seMap.set(
          noteType.name,
          new HowlPool(async () => await this.loadAudio(sePath), 10)
        );
      }

      musicGameSystems.noteTypeMap.set(noteType.name, noteType);
    }

    (window as any).CustomRendererUtility = CustomRendererUtility;

    // レーンのカスタムレンダラーを読み込む
    {
      const renderers = [
        ...new Set(
          musicGameSystems.laneTemplates
            .map(lt => ({ renderer: lt.renderer, laneTemplate: lt }))
            .filter(r => r.renderer !== "default")
        )
      ];

      for (const renderer of renderers) {
        const _path = path.join(rootPath, directory, renderer.renderer);

        const buffer: Buffer = await util.promisify(fs.readFile)(_path);

        const key = guid();

        const source = buffer
          .toString()
          .replace("export default", `window["${key}"] = `);

        eval(source);

        renderer.laneTemplate.rendererReference = (window as any)[key];
      }
    }

    // ノートのカスタムレンダラーを読み込む
    {
      const renderers = [
        ...new Set(
          (musicGameSystems.noteTypes || [])
            .map(lt => ({ renderer: lt.renderer, noteTemplate: lt }))
            .filter(r => r.renderer !== "default")
        )
      ];

      for (const renderer of renderers) {
        const rendererPath = path.join(rootPath, directory, renderer.renderer);

        const buffer: Buffer = await util.promisify(fs.readFile)(rendererPath);

        const key = guid();

        const source = buffer
          .toString()
          .replace("export default", `window["${key}"] = `);

        eval(source);

        renderer.noteTemplate.rendererReference = (window as any)[key];
      }
    }

    // ノートラインのカスタムレンダラーを読み込む
    {
      const renderers = musicGameSystems.customNoteLineRenderers || [];
      musicGameSystems.customNoteLineRendererMap = new Map<
        string,
        CustomNoteLineRenderer
      >();

      for (const renderer of renderers) {
        const rendererPath = path.join(rootPath, directory, renderer.renderer);

        const buffer: Buffer = await util.promisify(fs.readFile)(rendererPath);
        const key = guid();

        const source = buffer
          .toString()
          .replace("export default", `window["${key}"] = `);

        // console.log(source);

        eval(source);

        renderer.rendererReference = (window as any)[key];

        musicGameSystems.customNoteLineRendererMap.set(
          renderer.target,
          renderer
        );
      }
    }

    // 小節のカスタムレンダラーを読み込む
    {
      const measureRenderer = musicGameSystems.measure.renderer;

      if (measureRenderer !== "default") {
        const rendererPath = path.join(rootPath, directory, measureRenderer);

        const buffer: Buffer = await util.promisify(fs.readFile)(rendererPath);
        const key = guid();

        const source = buffer
          .toString()
          .replace("export default", `window["${key}"] = `);

        eval(source);

        musicGameSystems.measure.rendererReference = (window as any)[key];
      }
    }

    this.addMusicGameSystem(musicGameSystems);
  }

  constructor(debugMode: boolean) {
    (async () => {
      await this.loadAssets();

      if (debugMode) {
        this.debugInitialize();
      }
    })();
  }

  @action
  pushAudioAssetPath(path: string) {
    this.audioAssetPaths.push(path);
  }

  loadAudioAsset(path: string) {
    console.log("loadAudioAsset", path);

    const buffer: Buffer = fs.readFileSync(path);

    return buffer;
  }

  @action
  private async checkAudioAssetDirectory(dir: string) {
    const files: any[] = await util.promisify(fs.readdir)(dir);

    var fileList = files.filter(function(file) {
      return (
        fs.statSync(path.join(dir, file)).isFile() &&
        /.*\.(wav|mp3)$/.test(file)
      ); //絞り込み
    });

    for (const fileName of fileList) {
      this.pushAudioAssetPath(`${dir}/${fileName}`);
    }
  }

  @action
  openAudioAssetDirectory() {
    const [dir] = remote.dialog.showOpenDialog({
      properties: ["openDirectory"]
    });
    this.checkAudioAssetDirectory(dir);
  }
}