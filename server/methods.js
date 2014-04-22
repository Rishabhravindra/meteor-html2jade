Meteor.methods({
  'html2jade': function (html, mcheck) { 
    
    Future = Meteor.require('fibers/future')
    Meteor.require('contextify')
    
    var html2jade = Meteor.require('html2jade')
    var fut = new Future()
    
    html2jade.convertHtml(html, {double: true, donotencode: true}, function (err, jade) {
      jadeArr = jade.match(/[^\r\n]+/g)
      
      // Remove extra html/body tags & preceding 4 spaces
      if (html.indexOf('<html') === -1) {
        jadeArr.splice(0, 2) // Remove html & body
        _.each(jadeArr, function (e, i, arr) {
          arr[i] = e.substring(4, e.length)
        })    
      }
      
      if (mcheck) {
        jade = new JadeBlock(html, jadeArr)
        fut.return(jade.filterHandlebars())
      } else {
        fut.return(jadeArr.join('\r\n'))
      }      
    })
    
    return fut.wait()
  }
})

function JadeBlock(html, jadeArr) {
  this.html = html
  this.jadeArr = jadeArr
}

JadeBlock.prototype.filterHandlebars = function (){
  var result = '', 
      level = 0,
      lineBefore = '',
      markdownBlock = false

  _.each(this.jadeArr, function (line){
    var newLine = new JadeLine(line, {
                          level: level, 
                          lineBefore: lineBefore, 
                          markdownBlock: markdownBlock
                      })
    result += newLine.preProcess()
                      .tagFilters() 
                      .postProcess()
                      .line
                      
    lineBefore = line
    level = newLine.newLevel    
    markdownBlock = newLine.markdownBlock
  })
  
  result =  result.replace(/&#34;/g, '"')
                  .replace(/&#39;/g, '"')
  
  return result
}

function JadeLine(line, args) {
  this.line = line
  this.level = args.level || ''
  this.newLevel = args.level
  this.lineBefore = args.lineBefore || ''
  this.markdownBlock = args.markdownBlock || false
}

JadeLine.prototype.preProcess = function (){
  return this  
}

JadeLine.prototype.tagFilters = function (){
  if (this.line.indexOf('| {{#') > -1) {
    // Open tag
    var p1 = this.line.indexOf('#'),
        p2 = this.line.indexOf('}', p1)
    this.tag = this.line.substring(p1+1, p2)
    this.newLevel += 1
    if (this.tag.indexOf('markdown') > -1) {
      this.markdownBlock = true
      this.line = this.line.replace('| {{#', ':')
                           .replace('}}','')                           
    } else {
      this.line = this.line.replace('| {{#', '')
                           .replace('}}','')
    }    
  } else if (this.line.indexOf('| {{/')  > -1) {
    // Close tag
    var p1 = this.line.indexOf('/'),
        p2 = this.line.indexOf('}', p1)
    this.tag = this.line.substring(p1+1, p2)
    this.newLevel -= 1
    this.line = ''
    if (this.tag.indexOf('markdown') > -1) {
      this.markdownBlock = false
    }
  } else if (this.line.indexOf('| {{else}}')  > -1) {
    // else tag
    this.line = this.line.replace('  | {{','')
                          .replace('}}','')
  } else if (this.line.indexOf('| {{&#62; ') > -1) {    
    // Embed template tag
    this.line = this.line.replace('| {{&#62; ', '+')
                          .replace('}}','')
  } else if (this.line.indexOf('{{&#62; ') > -1) {    
    // Inline template tag
    var leadingSpaces = this.getLeadingSpaces(this.lineBefore) + '  ' 
    this.line = this.line.replace('{{&#62; ', '\r\n' + leadingSpaces + '+')
                          .replace('}}','')
  } else if (this.markdownBlock && this.line.indexOf('| ') > -1) {
    // Inside markdown block    
    this.line = this.line.replace('| ', '')
  }
  
  return this
}

JadeLine.prototype.postProcess = function (){
  if (this.line.length > 0) {
    if (this.level) {    
      this.padLine()
    }
    if (this.line.length) {
      this.line = this.line + '\r\n'
    }
  }    
  return this
}

JadeLine.prototype.padLine = function () {
  var level = this.level
  while (level-- > 0) {
    this.line = '  ' + this.line
  }
}

JadeLine.prototype.getLeadingSpaces = function (str) {
  var n = str.match(/^\s{0,9999}/)[0].length,
      result = ''
  while (n-- > 0) {
    result += ' '
  }
  return result
}
