# Pachinko Member Frontend

このプロジェクトは、会員向けのスロット（ルーレット）演出を提供する React + TypeScript + Vite 製のフロントエンドです。WebSocket 経由でゲーム開始イベントを受け取り、指定した演出設定に従ってスロットを回転させます。

## プロジェクト構成

レイヤードアーキテクチャを採用し、主要な責務を以下のように分離しています。

| レイヤー | 役割 | 主な配置場所 |
| --- | --- | --- |
| **domain** | ルーレットの回転時間やシンボル定義、乱数生成など、ビジネスロジックの中心となる純粋なモデルを保持します。 | `src/domain/*` |
| **usecases** | ドメインを利用してアプリの振る舞いを調整するユースケース。ラウンド演出の計画やシンボルのプリロードなど、アプリの「やること」をまとめます。 | `src/usecases/*` |
| **infrastructure** | WebSocket ゲートウェイやオーディオ再生など、外部環境とのやり取りを担うアダプター層です。 | `src/infrastructure/*` |
| **presentation** | React コンポーネントや UI 用フックをまとめたプレゼンテーション層。ユーザーとのインタラクションと画面表示を担当します。 | `src/presentation/*` |

エントリーポイントとなる `src/main.tsx` からプレゼンテーション層を呼び出し、必要に応じて他レイヤーの機能を依存注入します。

## セットアップ

```bash
npm install
npm run dev
```

`.env` に `VITE_WEBSOCKET_URL` を設定すると、既定 URL の代わりにそのエンドポイントへ接続します。

## 実行時シーケンス

### ① Welcome モーダルダイアログを閉じた後の処理

```mermaid
sequenceDiagram
  actor User
  participant WelcomeModal
  participant App
  participant SoundEffects
  participant SlotWebSocketGateway as WebSocketGateway

  User->>WelcomeModal: タップして閉じる
  WelcomeModal->>App: onTap コールバック
  App->>SoundEffects: enable() で効果音を解放
  SoundEffects-->>App: 再生許可結果
  App->>SlotWebSocketGateway: connect() で WebSocket 接続開始
  SlotWebSocketGateway-->>App: roundStart 受信用のリスナーを登録
  App->>WelcomeModal: モーダルを非表示にする
```

### ② WebSocket を受信してスロットが回る処理

```mermaid
sequenceDiagram
  participant WebSocketGateway as WebSocket 受信口
  participant RoundOrchestrator as 演出制御ロジック
  participant PresentationPlanner as 演出計画生成
  participant SlotInterface as スロット UI
  participant AudioPlayer as 効果音再生

  WebSocketGateway->>RoundOrchestrator: ラウンド開始イベントを受信
  RoundOrchestrator->>PresentationPlanner: 受信内容を基に演出方針を作成
  PresentationPlanner-->>RoundOrchestrator: リール停止順・演出タイミング・効果音の指示
  RoundOrchestrator->>AudioPlayer: 開始演出用のサウンドを再生するよう依頼
  RoundOrchestrator->>SlotInterface: 準備状態への遷移や回転開始などの UI 更新を指示
  RoundOrchestrator->>SlotInterface: リーチ演出が必要なら追加演出を指示
  RoundOrchestrator->>AudioPlayer: 勝利時は勝利演出サウンドを再生するよう依頼
  AudioPlayer-->>RoundOrchestrator: 効果音再生が完了したことを通知
  SlotInterface-->>RoundOrchestrator: 勝利演出の表示完了を報告
```
