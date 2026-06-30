// Renderer インターフェース（抽象基底）。
// 将来 ThreeRenderer 等を同じ interface で実装すれば、main.js の生成箇所だけで差し替えられる。
// 描画は frameState を受け取って描くだけ。ゲーム状態を書き換えてはならない。

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} options { devicePixelRatio }
   */
  init(canvas, options) {
    throw new Error('Renderer.init not implemented');
  }

  /**
   * 表示領域の変更を反映する。
   * @param {{ cssWidth:number, cssHeight:number }} viewport
   */
  resize(viewport) {
    throw new Error('Renderer.resize not implemented');
  }

  /**
   * 1 フレーム描画する。
   * @param {object} frameState 読み取り専用のスナップショット
   */
  render(frameState) {
    throw new Error('Renderer.render not implemented');
  }

  /**
   * クライアント座標（pointer event の clientX/Y）をグリッド座標へ変換する。
   * 入力処理が利用する。範囲外なら null。
   * @returns {{x:number,y:number}|null}
   */
  clientToCell(clientX, clientY) {
    throw new Error('Renderer.clientToCell not implemented');
  }

  /** 後始末 */
  destroy() {}
}
