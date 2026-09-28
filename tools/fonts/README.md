# フォントのサブセット化

同梱フォント（M PLUS Rounded 1c・SIL Open Font License 1.1）を、ゲームで使う文字だけに絞って woff2 にする。

```sh
pip install fonttools brotli          # pyftsubset（woff2 の圧縮に brotli が必要）
node tools/fonts/subset.mjs           # PYFTSUBSET=<パス> で pyftsubset の場所を指定できる
```

- 収録する文字: i18n（`apps/client/src/i18n/*.json`）の全文言・英数字記号・ひらがな・カタカナ・よく使う記号（`charset.txt`）
- 出力: `apps/client/src/assets/fonts/m-plus-rounded-1c-{400,800}.woff2`（ライセンス文 `OFL.txt` と一緒に同梱する）
- フォントの TTF は Google Fonts から取得し、`tools/fonts/.cache/`（git 管理外）に置く
- **i18n の文言を変えたら実行し直す**（新しい漢字が収録されていないと `apps/client/test/fonts.test.ts` が失敗する）
- 表示名など収録外の文字は、端末の日本語フォントで表示される（`apps/client/src/config/fonts.ts` の `FONT_STACK`）
