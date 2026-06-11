const { bot, yts, song, video, addAudioMetaData, generateList, lang, YT_URL_REGEX } = require('../lib/')

bot(
  {
    pattern: 'yts ?(.*)',
    desc: lang.plugins.yts.desc,
    type: 'search',
  },
  async (message, match) => {
    if (!match) return await message.send(lang.plugins.yts.usage)

    const vid = YT_URL_REGEX.exec(match)

    // 🔹 Direct URL info
    if (vid) {
      const result = await yts(vid[1], true, null, message.id)
      if (!result || !result.length) return await message.send(lang.plugins.yts.no_result)

      const { title, description, duration, view, published } = result[0] || {}

      return await message.send(
        `${lang.plugins.yts.title}${title}\n` +
        `${lang.plugins.yts.time}${duration}\n` +
        `${lang.plugins.yts.views}${view}\n` +
        `${lang.plugins.yts.publish}${published}\n` +
        `${lang.plugins.yts.desc_label}${description}`
      )
    }

    // 🔹 Search query
    const result = await yts(match, false, null, message.id)
    if (!result || !result.length) return await message.send(lang.plugins.yts.no_result)

    const msg = result.map(({ title, id, view, duration, published, author }) => {
      const url = id.startsWith('http')
        ? id
        : `https://www.youtube.com/watch?v=${id}`

      return `• *${(title || '').trim()}*\n` +
        `${view ? `${lang.plugins.yts.views}${view}\n` : ''}` +
        `${lang.plugins.yts.time}${duration}\n` +
        `${lang.plugins.yts.author}${author}\n` +
        `${published ? `${lang.plugins.yts.publish}${published}\n` : ''}` +
        `${lang.plugins.yts.url}${url}\n\n`
    }).join('')

    return await message.send(msg.trim())
  }
)

bot(
  {
    pattern: 'song ?(.*)',
    desc: lang.plugins.song.desc,
    type: 'download',
  },
  async (message, match) => {
    match = match || message.reply_message?.text
    if (!match) return await message.send(lang.plugins.song.usage)

    const isDirect = YT_URL_REGEX.test(match)

    // 🔹 Direct URL
    if (isDirect) {
      const { buffer, title, author, thumbnail } = await song(match, message.id)
      if (!buffer) return await message.send(lang.plugins.song.not_found)

      const meta = await addAudioMetaData(
        buffer,
        title,
        author,
        '',
        thumbnail?.url || thumbnail
      )

      return await message.send(
        meta,
        { quoted: message.data, mimetype: 'audio/mpeg', fileName: `${title}.mp3` },
        'audio'
      )
    }

    // 🔹 Search then pick
    const result = await yts(match, false, 1, message.id)
    if (!result || !result.length)
      return await message.send(lang.plugins.song.no_result.format(match))

    const msg = generateList(
      result.map(({ title, id, duration, author, album }) => ({
        _id: lang.plugins.song.id_label,
        text:
          `🎵${title}\n` +
          `🕒${duration}\n` +
          `👤${author}\n` +
          `📀${album || 'Unknown'}\n\n`,
        id: `song ${id.startsWith('http') ? id : `https://www.youtube.com/watch?v=${id}`}`,
      })),
      lang.plugins.song.list_header.format(match, result.length),
      message.jid,
      message.participant,
      message.id
    )

    return await message.send(msg.message, { quoted: message.data }, msg.type)
  }
)

bot(
  {
    pattern: 'video ?(.*)',
    desc: lang.plugins.video.desc,
    type: 'download',
  },
  async (message, match) => {
    match = match || message.reply_message?.text
    if (!match) return await message.send(lang.plugins.video.usage)

    let quality = null
    let urlMatch = match

    // 🔹 Extract quality safely
    const qualityMatch = match.match(/^(1080p|720p|480p|360p|240p|144p)\s+(.+)$/i)
    if (qualityMatch) {
      quality = qualityMatch[1]
      urlMatch = qualityMatch[2]
    }

    const vid = YT_URL_REGEX.exec(urlMatch)

    // 🔹 If NOT URL → search first
    if (!vid) {
      const result = (await yts(urlMatch, false, null, message.id))?.filter(v => !v.isMusic)

      if (!result || !result.length)
        return await message.send(lang.plugins.video.not_found)

      const msg = generateList(
        result.map(({ title, id, duration, view }) => ({
          text:
            `${title}\n` +
            `duration : ${duration}\n` +
            `views : ${view}\n`,
          id: `video ${quality ? quality + ' ' : ''}https://www.youtube.com/watch?v=${id}`,
        })),
        lang.plugins.video.list_header.format(urlMatch, result.length),
        message.jid,
        message.participant,
        message.id
      )

      return await message.send(msg.message, { quoted: message.data }, msg.type)
    }

    // 🔹 Direct download
    const options = quality ? { videoQuality: quality } : {}

    const res = await video(vid[1], message.id, options)
    if (!res) return await message.send(lang.plugins.video.not_found)

    return await message.send(
      res,
      { quoted: message.data, fileName: `${vid[1]}.mp4` },
      'video'
    )
  }
)
