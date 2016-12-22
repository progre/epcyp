var gulp = require('gulp');
var plumber = require('gulp-plumber');
var coffee = require("gulp-coffee");
var jade = require("gulp-jade");
var del = require('del');

// mainプロセスファイルをcoffeeコンパイル
gulp.task('coffee', function(){
  gulp.src('src/coffee/main.coffee')
    .pipe(plumber())
    .pipe(coffee({
      pretty: true
    }))
    .pipe(gulp.dest('./dist'));
});

// jadeコンパイル
gulp.task('jade', function(){
  gulp.src('src/jade/**/*.jade')
    .pipe(plumber())
    .pipe(jade({
      pretty: true
    }))
    .pipe(gulp.dest('dist/'));
});

gulp.task('clean', function(cb) {
  del(['dist', '**/*.log'], cb);
});

gulp.task('default', ['coffee', 'jade']);
