# NovelReader

NovelReader は、ローカルに保存した小説ファイルをブラウザ上で読みやすい形に変換して楽しむための、オープンソースのWeb小説リーダーです。

現在の最優先目標は、**ハーメルンからユーザー自身が保存したPDFを読み込み、小説リーダー形式で表示できること**です。

> [!IMPORTANT]
> NovelReader はハーメルン公式のツールではなく、ハーメルンとは提携していません。PDFや抽出した本文をNovelReader側のサーバーへ送信する設計にはせず、ブラウザ内で処理する方針です。

## 現在できること

- GitHub Pages上で動作する静的Webアプリ
- ライブラリ画面
- サンプル作品の閲覧
- 前話 / 次話への移動
- 読書位置の保存
- 紙 / ダークテーマ
- 文字サイズ・行間・本文幅の変更
- PDFファイルの選択とブラウザ内での文字抽出（試験実装）
- PDF内の「第○話」「第○章」「プロローグ」などを使った簡易的な話分割（試験実装）

## 最優先: ハーメルンPDF対応

PDF取り込みの基盤には Mozilla PDF.js (`pdfjs-dist`) を使用します。

現在は次の流れまで実装しています。

```text
PDFを選択
  ↓
ブラウザ内でPDF.jsが解析
  ↓
テキスト抽出
  ↓
簡易的に話タイトルを検出
  ↓
NovelReaderの作品データへ変換
  ↓
Readerで表示
```

ただし、**ハーメルンPDF固有のレイアウト解析はまだ調整中**です。実際のPDFで、以下を順番に対応します。

- 作品タイトルの取得
- 作者名の取得
- 各話タイトルの正確な検出
- 本文の改行・段落の復元
- ページ番号やヘッダー / フッターの除去
- ルビの復元
- 挿絵の取り込み
- 複数話を含むPDFの安定した分割

実PDFをリポジトリへ同梱することはせず、テストが必要な場合も権利面に配慮したデータを使用します。

## プライバシー方針

NovelReaderは、インポートしたPDFや小説本文を外部サーバーへアップロードしない方針です。

現在のPDF試験実装も、選択したPDFをブラウザ内のJavaScriptで解析します。将来的な保存機能もIndexedDBなどのブラウザ内ストレージを基本とします。

## 著作権について

NovelReader自体は小説作品を提供・配布しません。

利用者は、読み込むPDFや文書を利用する権利があることを自身で確認してください。第三者の著作物をGitHub等へ再配布する用途は想定していません。

## 技術構成

- React
- TypeScript
- Vite
- Mozilla PDF.js (`pdfjs-dist`)
- GitHub Pages
- GitHub Actions

## ローカル開発

Node.js 22 以降を推奨します。

```bash
npm install
npm run dev
```

本番ビルド:

```bash
npm run build
npm run preview
```

## GitHub Pages

`main` ブランチへのpushで `.github/workflows/deploy-pages.yml` が実行され、GitHub Pagesへデプロイされます。

## ロードマップ

詳細は [PLAN.md](./PLAN.md) を参照してください。作業単位は [TASKS.md](./TASKS.md) で管理します。

大きな順序は次の通りです。

1. ハーメルンPDFの読み込みを実用レベルにする
2. 読み込んだ作品をIndexedDBへ保存する
3. Readerの表示品質を上げる
4. 縦書き・目次・検索・ブックマークを追加する
5. PWA / オフライン対応
6. 必要に応じてEPUB / TXT / HTMLなどへ拡張する

## コントリビューション

Issue・Pull Requestを歓迎します。詳しくは [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

## ライセンス

NovelReaderのソースコードはMIT Licenseで公開しています。詳しくは [LICENSE](./LICENSE) を参照してください。
