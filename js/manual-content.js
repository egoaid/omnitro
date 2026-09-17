const MANUAL_SECTIONS = [
  {
    titleJa: 'はじめに', titleEn: 'Overview',
    bodyJa: `
      <p><b>omnitro（オムニトロ）</b>は、コードボタンとストラムプレートで演奏する、レトロな電子コード楽器の
      操作感を意識したブラウザ演奏アプリです。左側のコードボタンで和音を選び、
      右側（または下側）のストラムプレートを指でなぞることで、独特の"シャラン"という
      きらめくアルペジオ・サウンドを演奏できます。</p>
      <p>コード演奏・ストラムプレート・リズムマシン・録音（MIX STUDIO）・マイク入力・PCキーボード演奏・
      MIDIキーボード演奏まで、ひとつの演奏体験として1つのアプリにまとめています。</p>
      <p>この説明書はSETTINGS画面右上の「MANUAL」ボタンからいつでも開けます。</p>`,
    bodyEn: `
      <p><b>omnitro</b> is a browser-based playing app inspired by the feel of vintage
      button-chord / strumplate electronic instruments. Pick a chord with the buttons
      on the left, then run your finger across the strumplate on the right (or bottom) to play
      that signature shimmering, cascading arpeggio sound.</p>
      <p>Chord play, the strumplate, a built-in rhythm machine, recording (Mix Studio), microphone
      input, PC-keyboard play and MIDI-keyboard play are all combined into a single instrument.</p>
      <p>You can open this manual any time from the "MANUAL" button on the SETTINGS screen.</p>`,
  },
  {
    titleJa: 'コード演奏（SIMPLEモード）', titleEn: 'Chord Play (Simple Mode)',
    bodyJa: `
      <p>画面左側には12個のルート音（五度圏順：D♭ A♭ E♭ B♭ F C G D A E B F♯）× 3種類
      （<b>MAJ</b> / <b>MIN</b> / <b>7</b>）のボタンが並んでいます。1つ押すだけでメジャー／マイナー／
      セブンスコードが鳴ります。</p>
      <h3>同時押しで複雑なコードに</h3>
      <ul>
        <li>MAJ + 7 → <b>MAJ7</b></li>
        <li>MIN + 7 → <b>MIN7</b></li>
        <li>MAJ + MIN → <b>DIM</b>（ディミニッシュ）</li>
        <li>MAJ + MIN + 7 → <b>AUG</b>（オーギュメント）</li>
        <li>MAJ(ルートN) + 7(1つ左隣のルート) → <b>SUS4</b></li>
        <li>MAJ(ルートN) + MIN(1つ左隣のルート) → <b>ADD9</b></li>
      </ul>
      <p>選んだコード名は、ストラムプレート上の「chord display」に表示されます。</p>
      <h3>CHORD HOLD / CHORD AUTO（設定パネル内）</h3>
      <p><b>CHORD HOLD</b>をONにすると、指を離してもコードボタンが点灯したまま次のストラムに備えます
      （実機のホールド機能に相当）。<b>CHORD MANUAL / AUTO</b>をONにすると、ボタンを押した瞬間に
      コード自体も鳴ります（OFFの場合はストラムプレートに触れたときだけ音が出ます）。</p>
      <h3>INSTANT OFF</h3>
      <p>ストラムプレート上部の赤い「■ OFF」ボタンを押すと、鳴っている全ての音を即座に止め、
      押しているコードもリセットします。演奏を素早く仕切り直したいときに使います。</p>`,
    bodyEn: `
      <p>On the left side are 12 root buttons (circle-of-fifths order: D♭ A♭ E♭ B♭ F C G D A E B F♯),
      each with 3 chord-type columns: <b>MAJ</b> / <b>MIN</b> / <b>7</b>. Press one to play a major,
      minor, or seventh chord.</p>
      <h3>Press multiple buttons together for complex chords</h3>
      <ul>
        <li>MAJ + 7 → <b>MAJ7</b></li>
        <li>MIN + 7 → <b>MIN7</b></li>
        <li>MAJ + MIN → <b>DIM</b> (diminished)</li>
        <li>MAJ + MIN + 7 → <b>AUG</b> (augmented)</li>
        <li>MAJ (root N) + 7 (one step to the left) → <b>SUS4</b></li>
        <li>MAJ (root N) + MIN (one step to the left) → <b>ADD9</b></li>
      </ul>
      <p>The resolved chord name appears in the "chord display" above the strumplate.</p>
      <h3>CHORD HOLD / CHORD AUTO (in Settings)</h3>
      <p>With <b>CHORD HOLD</b> on, the chord buttons stay lit after you release your fingers so the
      chord is ready for your next strum (just like the hold feature on the original hardware).
      With <b>CHORD MANUAL / AUTO</b> on, the chord itself sounds the instant you press the button
      (when off, sound only comes from touching the strumplate).</p>
      <h3>INSTANT OFF</h3>
      <p>The red "■ OFF" pad above the strumplate instantly silences everything currently sounding
      and clears the held chord — handy for a quick reset between takes.</p>`,
  },
  {
    titleJa: 'ストラムプレート', titleEn: 'The Strumplate',
    bodyJa: `
      <p>選んだコードの構成音は、単純な音階順ではなく、独自の配列ロジックでストラムプレート上に
      並んでいます。</p>
      <ul>
        <li><b>タップ</b>：軽く触れるとその位置の音が1つ鳴ります。</li>
        <li><b>スライド（ストラム）</b>：指でなぞると、通過した位置の音が次々に鳴り、
          "シャラララ"というアルペジオになります。</li>
        <li><b>マルチタッチ</b>：最大3本指まで同時に認識し、指ごとに色分けされたインジケーターが
          表示されます。和音を厚く鳴らしたいときに複数指でなぞってみてください。</li>
      </ul>
      <p>ストラムプレートは縦方向（上＝高い音、下＝低い音）に配置されています。</p>`,
    bodyEn: `
      <p>The notes of the selected chord are laid out on the strumplate using a distinctive
      ordering logic — not a simple ascending scale.</p>
      <ul>
        <li><b>Tap</b>: a light touch plays a single note at that position.</li>
        <li><b>Slide (strum)</b>: dragging your finger triggers each note it passes over in
          sequence, producing that cascading arpeggio shimmer.</li>
        <li><b>Multi-touch</b>: up to 3 fingers are tracked at once, each with its own colored
          indicator — try strumming with more than one finger for a fuller sound.</li>
      </ul>
      <p>The strumplate runs vertically (top = high notes, bottom = low notes).</p>`,
  },
  {
    titleJa: 'キーボード演奏 / MIDI', titleEn: 'Keyboard Play / MIDI',
    bodyJa: `
      <p>PCキーボードでもコードボタンを演奏できます（複数キー同時押し対応）。</p>
      <table class="manual-spec-table">
        <tr><td>MAJ列</td><td><span class="manual-kbd">A S D F G H J K L ; : ]</span></td></tr>
        <tr><td>MIN列</td><td><span class="manual-kbd">Q W E R T Y U I O P @ [</span></td></tr>
        <tr><td>7列</td><td><span class="manual-kbd">1 2 3 4 5 6 7 8 9 0 - ^</span></td></tr>
      </table>
      <p>各列は五度圏順の12ルートに左から順に対応しています。</p>
      <h3>MIDIキーボード</h3>
      <p>USB/BluetoothのMIDIキーボードを接続すると、自動的に認識され演奏に使えます。
      既定（<b>NORMAL</b>）では、ごく普通のMIDIキーボードとして半音階（ドレミファソラシド）で
      鳴ります。コードの選択状態には連動しません。</p>
      <h3>MIDI STRUM MODE（設定パネル）</h3>
      <p>SETTINGS →「REAL TIME CONTROL」の<b>MIDI STRUM MODE</b>をONにすると、鍵盤の演奏音が
      <b>今選んでいるコードの構成音だけ</b>に強制的にマッピングされます。鍵盤の位置
      （MIDIノート36〜60＝C2〜C4、ちょうど2オクターブ＝25鍵分）がそのままストラムプレートの
      低音〜高音の位置に対応し、鍵盤を弾くことがストラムプレートを指でなぞるのと同じ動作になります。
      ストラムプレートの13音（4オクターブ分に配置されていますが実際に鳴るのは13音）を
      25鍵の範囲にきれいに収めているので、25鍵タイプのMIDIキーボードでも端から端まで
      すべての音に届きます。お使いのキーボードの最低鍵がMIDIノート36（C2）付近に来るよう、
      キーボード本体のオクターブシフトボタンで合わせてください。つまり、
      マウスやPCキーボードでコードボタンを押してコードを選んでおけば、鍵盤のどこを弾いても
      そのコードから外れた音は出ません。コードが選択されていない間は音が出ないので、
      先にコードを選んでから演奏してください。</p>`,
    bodyEn: `
      <p>Chord buttons can also be played from a PC keyboard (multiple keys at once are supported).</p>
      <table class="manual-spec-table">
        <tr><td>MAJ row</td><td><span class="manual-kbd">A S D F G H J K L ; : ]</span></td></tr>
        <tr><td>MIN row</td><td><span class="manual-kbd">Q W E R T Y U I O P @ [</span></td></tr>
        <tr><td>7 row</td><td><span class="manual-kbd">1 2 3 4 5 6 7 8 9 0 - ^</span></td></tr>
      </table>
      <p>Each row maps left-to-right to the 12 circle-of-fifths roots.</p>
      <h3>MIDI keyboard</h3>
      <p>A connected USB/Bluetooth MIDI keyboard is detected automatically and ready to play.
      By default (<b>NORMAL</b>), it behaves like an ordinary MIDI keyboard, playing a plain
      chromatic scale — it is not tied to whatever chord is currently selected.</p>
      <h3>MIDI STRUM MODE (in Settings)</h3>
      <p>Turn on <b>MIDI STRUM MODE</b> under Settings → "REAL TIME CONTROL" to force every note
      you play to be a note <b>from the currently selected chord only</b>. Key position (MIDI
      notes 36–60 / C2–C4, exactly 2 octaves = 25 keys) maps directly onto the strumplate's
      low-to-high range, so playing the keyboard becomes equivalent to running your finger across
      the strumplate. The strumplate's 13 notes (laid out across a 4-octave span, though only 13
      notes actually sound) fit neatly into that 25-key range, so a 25-key MIDI controller can
      reach every note from end to end. Use your keyboard's octave-shift buttons so its lowest key
      sits around MIDI note 36 (C2). In other words,
      once you've picked a chord with the mouse or PC keyboard, nothing outside that chord can
      come out of the MIDI keyboard. No sound is produced while no chord is selected, so pick a
      chord first.</p>`,
  },
  {
    titleJa: 'ボイス（音色）', titleEn: 'Voices',
    bodyJa: `
      <p>SETTINGSの「VOICE SELECT」から、ストラムプレート（と保持コード）の音色を10種類の中から
      選べます。</p>
      <ul>
        <li><b>OMNI 1 / OMNI 2</b> — このアプリの基本となる、温かみのあるオリジナルボイス</li>
        <li><b>HARP</b> — トライアングル波系の柔らかいハープ音</li>
        <li><b>CHEAP</b> — チープなおもちゃ楽器風の音色</li>
        <li><b>SYNTH</b> — のこぎり波ベースのシンセリード</li>
        <li><b>FLUTE</b> — サイン波中心の柔らかいフルート音</li>
        <li><b>GUITAR</b> — オクターブユニゾンを重ねたギター風</li>
        <li><b>FM PIANO</b> — 金属的な倍音とトレモロ感のあるFMエレピ</li>
        <li><b>ORGAN</b> — コーラスをかけたオルガン（レスリー風）</li>
        <li><b>VIBES</b> — 減衰の長いビブラフォン風</li>
      </ul>`,
    bodyEn: `
      <p>Choose from 10 voices for the strumplate (and held chords) under "VOICE SELECT" in
      Settings.</p>
      <ul>
        <li><b>OMNI 1 / OMNI 2</b> — the app's core, warm original voices</li>
        <li><b>HARP</b> — a soft, triangle-wave based harp tone</li>
        <li><b>CHEAP</b> — a deliberately cheap, toy-instrument style tone</li>
        <li><b>SYNTH</b> — a sawtooth-based synth lead</li>
        <li><b>FLUTE</b> — a gentle, sine-wave-centered flute</li>
        <li><b>GUITAR</b> — guitar-like tone with an octave-unison layer</li>
        <li><b>FM PIANO</b> — a metallic, FM-style electric piano with a tremolo shimmer</li>
        <li><b>ORGAN</b> — an organ with chorus (Leslie-style) movement</li>
        <li><b>VIBES</b> — a vibraphone-like tone with a long, ringing decay</li>
      </ul>`,
  },
  {
    titleJa: 'リズム', titleEn: 'Rhythm',
    bodyJa: `
      <p>ヘッダー右上の<b>RHYTHM</b>ボタン（またはPCキーボードの<span class="manual-kbd">Space</span>）で
      リズムパターンの再生・停止ができます。SETTINGSの「RHYTHM」グループでは、パターン選択・
      ドラムキット選択・テンポ・ボリュームを調整できます。全58種類のリズムパターン（LO-FI、JAZZ、
      HIP-HOP、WORLD、GROOVE、AMBIENTなど）と、9種類のドラムキット（808 / 909 / LM-1 / LOFI /
      TAPE / JAZZ / VINYL / MINIMAL / ACOUSTIC）から自由に組み合わせられます。</p>`,
    bodyEn: `
      <p>Use the <b>RHYTHM</b> button in the header (or <span class="manual-kbd">Space</span> on
      a PC keyboard) to start/stop the rhythm pattern. In the "RHYTHM" section of Settings you can
      choose the pattern, drum kit, tempo and volume. There are 58 built-in patterns in all (LO-FI,
      JAZZ, HIP-HOP, WORLD, GROOVE, AMBIENT and more), freely combinable with 9 drum kits (808 / 909 /
      LM-1 / LOFI / TAPE / JAZZ / VINYL / MINIMAL / ACOUSTIC).</p>`,
  },
  {
    titleJa: 'INTRO / FILL / ENDING', titleEn: 'Intro / Fill / Ending',
    bodyJa: `
      <p>実際のドラマーがその場で演奏しているかのような、曲の入り（INTRO）・つなぎのフィルイン
      （FILL）・締めくくり（ENDING）を自動生成する機能です。単純なランダム配置ではなく、
      複数の音楽的なテンプレートからランダムに選び、ベロシティやタイミングにも毎回わずかな
      揺らぎを加えているため、再生のたびに少しずつ違う自然な演奏になります。</p>
      <p>SETTINGSの「ARRANGEMENT」グループで、INTRO・FILL・ENDINGをそれぞれ個別にON/OFF
      できます（FILLは既定でON、INTRO・ENDINGは既定でOFF）。</p>
      <h3>INTRO</h3>
      <p>ONの場合、RHYTHMを開始すると自動的にINTROが1小節演奏され、終わると自然に通常の
      RHYTHM（MAIN）へ移行します。OFFの場合は、従来どおり即座にMAINで開始します。</p>
      <h3>FILL</h3>
      <p>ONの場合、RHYTHM再生中にヘッダーの<b>FILLボタン</b>（RHYTHM EDITOR・KIT EDITOR
      画面にもあります）またはPCキーボードの<span class="manual-kbd">B</span>キーを押すと、
      現在の小節が終わったタイミングでFILLへ切り替わり、1小節演奏したのち自然にMAINへ
      戻ります（戻る瞬間に着地のアクセントが1発添えられます）。OFFの場合、FILLボタンは
      表示されず発動もしません。すでにFILL/INTRO/ENDING中の二重発動は無視されます。</p>
      <h3>ENDING</h3>
      <p>ONの場合、RHYTHMを停止しようとすると即座には止まらず、今鳴っている小節が終わって
      からENDINGへ切り替わり、1小節演奏したのちに実際に停止します。OFFの場合は、従来どおり
      即座に停止します。</p>`,
    bodyEn: `
      <p>This feature automatically generates an intro, a connecting fill, and an ending, as if a
      real drummer were playing them on the spot. Rather than placing notes purely at random, it
      picks from a pool of musically-informed templates each time and adds small random variations
      in velocity and timing, so the result sounds a little different — and natural — every time.</p>
      <p>Each of INTRO, FILL, and ENDING can be turned on or off independently in the "ARRANGEMENT"
      group in Settings (FILL is on by default; INTRO and ENDING are off by default).</p>
      <h3>INTRO</h3>
      <p>When on, starting RHYTHM automatically plays a one-bar intro first, then transitions
      smoothly into the normal rhythm (MAIN). When off, RHYTHM starts on MAIN immediately, as before.</p>
      <h3>FILL</h3>
      <p>When on, pressing the <b>FILL button</b> in the header (also available on the RHYTHM EDITOR
      and KIT EDITOR screens) or the <span class="manual-kbd">B</span> key on a PC keyboard while
      RHYTHM is playing queues a fill starting at the end of the current bar; it plays for one bar
      and then returns naturally to MAIN (with a small landing accent on the way back). When off, the
      FILL button is hidden and does nothing. Triggering it again while a fill/intro/ending is
      already in progress is ignored.</p>
      <h3>ENDING</h3>
      <p>When on, stopping RHYTHM doesn't stop it instantly — the current bar finishes first, then
      a one-bar ending plays, and RHYTHM actually stops right after. When off, RHYTHM stops
      immediately, as before.</p>`,
  },
  {
    titleJa: 'RHYTHM EDITOR（リズムエディター）', titleEn: 'Rhythm Editor',
    bodyJa: `
      <p>SETTINGS →「RHYTHM」→「▶ PATTERN」で開きます。ピアノロール画面で各ドラムパートの
      タイミング・ベロシティ・確率・オフセットを細かく編集できます。</p>
      <ul>
        <li><b>タップ</b>（空きスペース）でノートを追加、既存ノートをタップで選択</li>
        <li><b>ドラッグ</b>で横方向にタイミング（マイクロオフセット）、縦方向にベロシティを調整</li>
        <li><b>ダブルタップ</b>でノートを削除</li>
        <li><b>長押し</b>でVEL（ベロシティ）/ OFFSET（ms）/ PROB（発音確率）/ GHOST（ゴースト音）
          を細かく設定するポップアップを表示</li>
        <li><b>QUANTIZE</b>（100% / 50% / 25% / OFF）と<b>APPLY Q</b>で全ノートを整列</li>
        <li><b>HUMANIZE</b>でタイミングとベロシティにランダムな揺らぎを加え、人間らしいグルーヴに</li>
        <li><b>★ RANDOM</b>でパターン全体をランダム生成（PCキーボードの
          <span class="manual-kbd">C</span>キーでも発動可能）</li>
        <li>名前を付けて保存、パターン一覧から読込、JSONでの書き出し／読み込みにも対応</li>
      </ul>
      <p>RHYTHM再生中に<b>★ RANDOM</b>や<b>HUMANIZE</b>を使った場合、その場で
      即座にシーケンスの先頭へジャンプすることはなく、今鳴っている小節を
      最後まで演奏したうえで、次の小節の頭から新しいパターンに自然に
      切り替わります。ライブ演奏中にRANDOM（<span class="manual-kbd">C</span>キー）を
      使ってその場で曲のリズムを変化させる、という使い方を想定した挙動です。</p>`,
    bodyEn: `
      <p>Open it from Settings → "RHYTHM" → "▶ PATTERN". The piano-roll screen lets you edit each
      drum part's timing, velocity, probability and micro-offset in detail.</p>
      <ul>
        <li><b>Tap</b> empty space to add a note; tap an existing note to select it</li>
        <li><b>Drag</b> horizontally for micro-timing offset, vertically for velocity</li>
        <li><b>Double-tap</b> a note to delete it</li>
        <li><b>Long-press</b> a note to open a popup with fine control over VEL (velocity),
          OFFSET (ms), PROB (probability) and GHOST (ghost note)</li>
        <li><b>QUANTIZE</b> (100% / 50% / 25% / OFF) plus <b>APPLY Q</b> snaps all notes to the grid</li>
        <li><b>HUMANIZE</b> adds natural random timing/velocity variation for a human feel</li>
        <li><b>★ RANDOM</b> generates an entirely new pattern (can also be triggered with the
          <span class="manual-kbd">C</span> key on a PC keyboard)</li>
        <li>Patterns can be named and saved, reloaded from the list, and exported/imported as JSON</li>
      </ul>
      <p>Using <b>★ RANDOM</b> or <b>HUMANIZE</b> while RHYTHM is playing does not jump the
      sequence back to the start immediately — the current bar keeps playing to the end, and the
      newly generated pattern takes over cleanly at the start of the next bar. This is designed
      for live use: pressing RANDOM (<span class="manual-kbd">C</span> key) mid-performance lets
      you change up the groove on the fly without breaking the beat.</p>`,
  },
  {
    titleJa: 'KIT EDITOR（ドラムキットエディター）', titleEn: 'Kit Editor',
    bodyJa: `
      <p>SETTINGS →「RHYTHM」→「▶ KIT EDIT」で開きます。KICK / SNARE / HI-CL / HI-OP / RIM /
      COWBL / CLAP / TAMB / SHKR の9チャンネルごとに、LEVEL・TUNE・PAN・ATTACK・DECAY・
      TRANSIENT・LPF/HPF・DRIVE・ROOMなど詳細なパラメータを調整できます。各チャンネルの
      「▶ TEST」ボタンで単発試聴が可能です。</p>
      <p><b>★ RANDOM</b>でキット全体をランダム生成（PANは全チャンネルが偶然同じ側に偏らないよう、
      左右にバランスよく分散するよう工夫されています）。名前を付けて保存、JSON書き出し／
      読み込みにも対応しています。</p>`,
    bodyEn: `
      <p>Open it from Settings → "RHYTHM" → "▶ KIT EDIT". Each of the 9 channels — KICK, SNARE,
      HI-CL, HI-OP, RIM, COWBL, CLAP, TAMB, SHKR — has detailed parameters: LEVEL, TUNE, PAN,
      ATTACK, DECAY, TRANSIENT, LPF/HPF, DRIVE, ROOM and more. Use each channel's "▶ TEST" button
      to audition it on its own.</p>
      <p><b>★ RANDOM</b> generates a whole new kit (PAN is deliberately spread left/right so
      channels don't all end up clustered on the same side by chance). Kits can be named and
      saved, and exported/imported as JSON.</p>`,
  },
  {
    titleJa: '録音とMIX STUDIO', titleEn: 'Recording & Mix Studio',
    bodyJa: `
      <p>ヘッダーの<b>REC</b>ボタンで録音を開始／停止します（最大10分）。停止すると自動的に
      <b>MIX STUDIO</b>画面が開きます。</p>
      <h3>マイク</h3>
      <p>SETTINGS →「MICROPHONE」で<b>MIC RECORDING</b>をONにすると、演奏と同時にマイクの声も
      録音できます。<b>MIC MONITOR</b>をONにすると自分の声をリアルタイムでモニターでき、
      <b>MIC LEVEL</b>で入力ゲインを調整できます。</p>
      <h3>MIX STUDIO</h3>
      <p>録音した「OMNI（演奏音）」「DRUM（リズム）」「VOCAL（マイク）」を個別にレベル・HPF
      調整でき、波形をタップして再生位置を移動できます。<b>FLAT / CLEAN / WARM / DEEP</b>の
      4プリセットに加え、VOCALにはOTT（マルチバンドダイナミクス）・DE-ESSも用意。MIX BUS全体には
      GLUE COMP・BUS REVERB・LIMITERがかけられます。</p>
      <p>書き出しは<b>MIX.wav</b>（全体2mix）、<b>VOCAL.wav</b>、<b>omni.wav</b>（演奏のみ）、
      <b>drum.wav</b>（ドラムのみ）から必要なものだけ選んでダウンロードできます。</p>`,
    bodyEn: `
      <p>Use the <b>REC</b> button in the header to start/stop recording (up to 10 minutes).
      When you stop, the <b>MIX STUDIO</b> screen opens automatically.</p>
      <h3>Microphone</h3>
      <p>Turn on <b>MIC RECORDING</b> under Settings → "MICROPHONE" to record your voice alongside
      your playing. <b>MIC MONITOR</b> lets you hear yourself in real time, and <b>MIC LEVEL</b>
      adjusts the input gain.</p>
      <h3>Mix Studio</h3>
      <p>The recorded "OMNI" (instrument), "DRUM" (rhythm) and "VOCAL" (mic) tracks each get their
      own level/HPF controls, and you can tap the waveform to jump the playhead. Four presets —
      <b>FLAT / CLEAN / WARM / DEEP</b> — are provided, plus OTT (multiband dynamics) and DE-ESS
      for vocals. The whole mix bus can be shaped with GLUE COMP, BUS REVERB and a LIMITER.</p>
      <p>Export whichever stems you need: <b>MIX.wav</b> (full 2-mix), <b>VOCAL.wav</b>,
      <b>omni.wav</b> (instrument only) and <b>drum.wav</b> (drums only).</p>`,
  },
  {
    titleJa: '設定パネルの主な項目', titleEn: 'Settings Panel Overview',
    bodyJa: `
      <ul>
        <li><b>MASTER VOLUME</b> — 全体の出力音量</li>
        <li><b>STRUM POLY / SUSTAIN / MAIN VOLUME / SUB VOLUME</b> — ストラムプレートの発音・
          余韻・音量バランスの調整</li>
        <li><b>RHYTHM</b> — パターン・キット選択、エディターを開くボタン、テンポ、ボリューム</li>
        <li><b>CHORD</b> — 保持コードの音量</li>
        <li><b>MICROPHONE</b> — マイク録音・モニター・入力レベル</li>
        <li><b>REAL TIME CONTROL</b> — CHORD MANUAL/AUTO、CHORD HOLD、MIDI STRUM MODEのON/OFF</li>
        <li><b>ARRANGEMENT</b> — INTRO / FILL / ENDINGのON/OFF（詳細は「INTRO / FILL / ENDING」の章を参照）</li>
      </ul>`,
    bodyEn: `
      <ul>
        <li><b>MASTER VOLUME</b> — overall output level</li>
        <li><b>STRUM POLY / SUSTAIN / MAIN VOLUME / SUB VOLUME</b> — balance and sustain of the
          strumplate voice</li>
        <li><b>RHYTHM</b> — pattern/kit selection, editor buttons, tempo and volume</li>
        <li><b>CHORD</b> — held-chord volume</li>
        <li><b>MICROPHONE</b> — mic recording, monitoring and input level</li>
        <li><b>REAL TIME CONTROL</b> — CHORD MANUAL/AUTO, CHORD HOLD, and MIDI STRUM MODE on/off</li>
        <li><b>ARRANGEMENT</b> — INTRO / FILL / ENDING on/off (see the "Intro / Fill / Ending" chapter for details)</li>
      </ul>`,
  },
  {
    titleJa: '仕様', titleEn: 'Specifications',
    bodyJa: `
      <table class="manual-spec-table">
        <tr><td>コード</td><td>12ルート × 9タイプ = 全108コード</td></tr>
        <tr><td>コードタイプ</td><td>MAJ / MIN / 7 / MAJ7 / MIN7 / DIM / AUG / SUS4 / ADD9</td></tr>
        <tr><td>ボイス（音色）</td><td>10種類（OMNI1, OMNI2, HARP, CHEAP, SYNTH, FLUTE, GUITAR, FM PIANO, ORGAN, VIBES）</td></tr>
        <tr><td>ストラムプレート</td><td>最大3本指マルチタッチ、タップ／スライド判定、独自の配列ロジックによる音配列</td></tr>
        <tr><td>リズムパターン</td><td>58種類（内蔵18＋LO-FIプリセット40）＋ユーザー保存無制限</td></tr>
        <tr><td>ドラムキット</td><td>9種類（808 / 909 / LM-1 / LOFI / TAPE / JAZZ / VINYL / MINIMAL / ACOUSTIC）＋ユーザー保存</td></tr>
        <tr><td>ドラムチャンネル</td><td>9系統（KICK, SNARE, HI-CL, HI-OP, RIM, COWBL, CLAP, TAMB, SHKR）</td></tr>
        <tr><td>INTRO / FILL / ENDING</td><td>再生のたびに自動生成される、テンプレートベースのアレンジ機能。設定でそれぞれ個別にON/OFF可能</td></tr>
        <tr><td>PCキーボード演奏</td><td>対応（複数キー同時押し可）。<span class="manual-kbd">Space</span>＝RHYTHM開始/停止、<span class="manual-kbd">B</span>＝FILL発動、<span class="manual-kbd">C</span>＝RHYTHM EDITORのRANDOM発動</td></tr>
        <tr><td>MIDI入力</td><td>Web MIDI API対応。既定は半音階演奏、MIDI STRUM MODE ON時はノート36〜60（C2〜C4、2オクターブ＝25鍵）を選択中コードのストラムプレート配列（13音）にマッピング</td></tr>
        <tr><td>録音</td><td>最大10分。演奏(OMNI)／ドラム／マイク(VOCAL)を個別ステムで同時録音</td></tr>
        <tr><td>書き出し形式</td><td>WAV（16bit PCM）。MIX / VOCAL / omni / drum を個別に書き出し可能</td></tr>
        <tr><td>MIX STUDIOエフェクト</td><td>HPF、OTT（マルチバンド）、DE-ESS、GLUE COMP、BUS REVERB、LIMITER、4種プリセット</td></tr>
        <tr><td>オーディオエンジン</td><td>Web Audio API（ネイティブ） + Tone.js v14.8.49</td></tr>
        <tr><td>データ保存</td><td>ユーザーパターン／キットはブラウザのlocalStorageに保存（端末・ブラウザ単位）</td></tr>
        <tr><td>推奨環境</td><td>Google Chrome（デスクトップ／モバイル）</td></tr>
        <tr><td>ライセンス</td><td>独自ライセンス。アプリ本体の複製・改変・再配布・販売、音色のサンプリング配布・販売は非営利でも禁止。制作した楽曲などの成果物の商用利用は自由</td></tr>
      </table>`,
    bodyEn: `
      <table class="manual-spec-table">
        <tr><td>Chords</td><td>12 roots × 9 types = 108 chords total</td></tr>
        <tr><td>Chord types</td><td>MAJ / MIN / 7 / MAJ7 / MIN7 / DIM / AUG / SUS4 / ADD9</td></tr>
        <tr><td>Voices</td><td>10 (OMNI1, OMNI2, HARP, CHEAP, SYNTH, FLUTE, GUITAR, FM PIANO, ORGAN, VIBES)</td></tr>
        <tr><td>Strumplate</td><td>Up to 3-finger multitouch, tap/slide gesture detection, distinctive proprietary note-layout logic</td></tr>
        <tr><td>Rhythm patterns</td><td>58 built-in (18 base + 40 Lo-Fi presets), plus unlimited user-saved patterns</td></tr>
        <tr><td>Drum kits</td><td>9 (808 / 909 / LM-1 / LOFI / TAPE / JAZZ / VINYL / MINIMAL / ACOUSTIC), plus user-saved kits</td></tr>
        <tr><td>Drum channels</td><td>9 (KICK, SNARE, HI-CL, HI-OP, RIM, COWBL, CLAP, TAMB, SHKR)</td></tr>
        <tr><td>Intro / Fill / Ending</td><td>Template-based arrangement feature, freshly generated on every playback; each can be toggled independently in Settings</td></tr>
        <tr><td>PC keyboard play</td><td>Supported, including multiple simultaneous keys. <span class="manual-kbd">Space</span> = start/stop RHYTHM, <span class="manual-kbd">B</span> = trigger FILL, <span class="manual-kbd">C</span> = trigger RANDOM in the Rhythm Editor</td></tr>
        <tr><td>MIDI input</td><td>Web MIDI API; chromatic by default, or notes 36–60 (C2–C4, 2 octaves = 25 keys) mapped onto the selected chord's 13-note strumplate layout when MIDI STRUM MODE is on</td></tr>
        <tr><td>Recording</td><td>Up to 10 minutes; instrument (OMNI), drums and mic (VOCAL) captured as separate stems simultaneously</td></tr>
        <tr><td>Export format</td><td>WAV (16-bit PCM); MIX / VOCAL / omni / drum can each be exported individually</td></tr>
        <tr><td>Mix Studio effects</td><td>HPF, OTT (multiband dynamics), DE-ESS, GLUE COMP, BUS REVERB, LIMITER, 4 presets</td></tr>
        <tr><td>Audio engine</td><td>Native Web Audio API + Tone.js v14.8.49</td></tr>
        <tr><td>Data storage</td><td>User patterns/kits are saved in the browser's localStorage (per device/browser)</td></tr>
        <tr><td>Recommended browser</td><td>Google Chrome (desktop or mobile)</td></tr>
        <tr><td>License</td><td>Custom license. Copying, modifying, redistributing or selling the app itself, and distributing/selling sampled voices, are prohibited even non-commercially. Commercial use of songs/works you create with it is permitted</td></tr>
      </table>`,
  },
];
