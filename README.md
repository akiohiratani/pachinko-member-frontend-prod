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
  participant SlotWebSocketGateway as WebSocketGateway
  participant SlotRoundController as RoundController
  participant SlotMachineManager as SlotManager
  participant SlotMachine as UI コンポーネント
  participant SoundEffects

  SlotWebSocketGateway->>RoundController: roundStart メッセージ
  RoundController->>SlotManager: planRound(payload)
  SlotManager-->>RoundController: 演出計画 (停止位置/演出時間/効果音)
  RoundController->>SoundEffects: playStart() で開始音を再生
  RoundController->>SlotMachine: onPrepare / onSpin で UI 状態を更新
  RoundController->>SlotMachine: onReachStart / onReachEnd (必要時)
  RoundController->>SoundEffects: playWinAlert() (勝利時)
  SoundEffects-->>RoundController: 再生完了
  SlotMachine-->>RoundController: UI が勝利演出を表示
```
