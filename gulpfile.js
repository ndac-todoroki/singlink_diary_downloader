var gulp = require('gulp'),
  clipboard = require('gulp-clipboard'),
  uglify = require('gulp-uglify'),
  rename = require('gulp-rename'),
  artoo = require('gulp-artoo'),
  browserify = require('browserify'),
  source = require('vinyl-source-stream')

gulp.task('uglify', function () {
  return gulp.src('./dest/assets/js/*.js')
    .pipe(uglify())
    .pipe(rename('singlink_diaries.bookmark.js'))
    .pipe(artoo())
    .pipe(clipboard())
    .pipe(gulp.dest('./build'));
});

gulp.task('browserify', function () {
  return browserify({ entries: ['index.js'] })
    .bundle()
    .pipe(source('index.js'))
    .pipe(gulp.dest('./dest/assets/js/'));
});

gulp.task('default', gulp.series('browserify', 'uglify'));
