import * as React from "react";
import { GUI, GUIController } from "dat-gui";

/**
 * フォルダを削除する GUI#removeFolder を定義
 */
Object.defineProperty(GUI.prototype, "removeFolder", {
  value(targetFolder: GUI) {
    const { name } = targetFolder;
    const folder = this.__folders[name];
    if (!folder) return;
    folder.close();
    this.__ul.removeChild(folder.domElement.parentNode);
    delete this.__folders[name];
    this.onResize();
  }
});

import config from "./config";
import { runInAction } from "mobx";
import { inject, InjectedComponent } from "./stores/inject";
import { observer } from "mobx-react";

/**
 * インスペクタコンポーネント
 */
@inject
@observer
export default class Inspector extends InjectedComponent {
  gameCanvas?: HTMLDivElement;

  gui = new GUI({ autoPlace: false });
  folders: GUI[] = [];
  controllers: GUIController[] = [];

  /**
   * 前回の対象オブジェクト
   */
  previousTarget: any | null | null;

  /**
   * オブジェクトをインスペクタにバインドする
   */
  bind = (target: any) => {
    if (this.previousTarget === target) return;
    this.previousTarget = target;

    console.log("update inspector");

    const obj = JSON.parse(JSON.stringify(target));

    // 既存のコントローラーを削除する
    for (const controller of this.controllers) {
      this.gui.remove(controller);
    }

    // 既存のフォルダを削除する
    for (const folder of this.folders) (this.gui as any).removeFolder(folder);

    this.controllers = [];
    this.folders = [];

    // プロパティを追加する
    const add = (gui: GUI, obj: any, parent: any) => {
      for (const key of Object.keys(obj)) {
        // オブジェクトなら再帰
        if (obj[key] instanceof Object) {
          const folder = gui.addFolder(key);
          this.folders.push(folder);
          add(folder, obj[key], parent[key]);
          continue;
        }

        let newController: GUIController | null = null;

        const isColor = key.toLowerCase().includes("color");

        if (isColor) {
          // 数値形式なら #nnnnnn 形式の文字列にする
          if (typeof obj[key] === "number") {
            obj[key] = "#" + obj[key].toString(16).padStart(6, "0");
          } else {
            obj[key] = obj[key].replace("0x", "#");
          }

          newController = gui.addColor(obj, key);
        } else {
          newController = gui.add(obj, key);
        }

        newController.onChange((value: any) => {
          // 色なら文字列から数値に変換する
          if (isColor) {
            value = parseInt(value.substr(1), 16);
          }
          runInAction("inspectorUpdateValue", () => {
            parent[key] = value;
          });
        });

        if (gui === this.gui) {
          this.controllers.push(newController);
        }
      }
    };

    add(this.gui, obj, target);
  };

  guiScale = 1.2;

  componentDidMount() {
    const gui = this.gui;
    const size = config.sidebarWidth;
    const scale = this.guiScale;

    gui.domElement.querySelector(".close-button")!.remove();

    (window as any).GUI = GUI;

    setInterval(() => {
      const w = gui.domElement.offsetWidth;
      const h = gui.domElement.offsetHeight;
      gui.domElement.style.transform = `scale(${scale})`;

      gui.width = size * (1 / scale);

      gui.domElement.style.marginLeft = `${(w * scale - w) / 2}`;
      gui.domElement.style.marginTop = `${(h * scale - h) / 2}`;
      gui.domElement.style.marginBottom = `${(h * scale - h) / 2}`;
    }, 100);

    this.gameCanvas!.appendChild(gui.domElement);
  }

  render() {
    this.bind(this.injected.editor.inspectorTarget);

    let component = this;
    return (
      <div>
        <div
          ref={thisDiv => {
            component.gameCanvas = thisDiv!;
          }}
        />
        {JSON.stringify(this.injected.editor.inspectorTarget)}
      </div>
    );
  }
}
